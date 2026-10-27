import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import type { ServiceRolesStack } from './service-roles-stack';

export interface ServiceStackProps extends cdk.StackProps {
  // Image tag in the ise-quiz-drill repository, the short commit SHA in CI
  imageTag: string;
  roles: ServiceRolesStack;
  // Who gets an email when the health alarm fires; none when left out
  alarmEmail?: string;
}

// Runs the app container on ECS Express Mode (see ADR-007)
export class ServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: ServiceStackProps) {
    super(scope, id, props);
    const serviceName = 'ise-quiz-drill';

    const service = new ecs.CfnExpressGatewayService(this, 'Service', {
      serviceName,
      infrastructureRoleArn: props.roles.infrastructureRole.roleArn,
      executionRoleArn: props.roles.executionRole.roleArn,
      primaryContainer: {
        image: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/ise-quiz-drill:${props.imageTag}`,
        containerPort: 4321,
      },
      healthCheckPath: '/api/health',
      cpu: '256',
      memory: '512',
      scalingTarget: { minTaskCount: 1, maxTaskCount: 2 },
    });

    // ARNs end in ":targetgroup/<name>/<id>" and ":loadbalancer/app/<name>/<id>";
    // CloudWatch dimensions want "targetgroup/<name>/<id>" and "app/<name>/<id>"
    const afterLastColon = (arn: string) =>
      cdk.Fn.select(5, cdk.Fn.split(':', arn));
    const loadBalancer = cdk.Fn.select(
      1,
      cdk.Fn.split(
        'loadbalancer/',
        service.attrEcsManagedResourceArnsIngressPathLoadBalancerArn,
      ),
    );
    const targetGroups =
      service.attrEcsManagedResourceArnsIngressPathTargetGroupArns;

    // One load balancer metric in one of the two target groups
    const inTargetGroup = (
      metricName: string,
      statistic: string,
      index: number,
    ) =>
      new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName,
        dimensionsMap: {
          LoadBalancer: loadBalancer,
          TargetGroup: afterLastColon(cdk.Fn.select(index, targetGroups)),
        },
        statistic,
        period: cdk.Duration.minutes(1),
      });

    // Express Mode rolls out a canary across two target groups; add both so
    // alarms and graphs see the tasks whichever one is live
    const bothTargetGroups = (
      metricName: string,
      statistic: string,
      label: string,
      // Ids must differ when two sums share one graph
      prefix = '',
    ) =>
      new cloudwatch.MathExpression({
        expression: `FILL(${prefix}blue, 0) + FILL(${prefix}green, 0)`,
        usingMetrics: {
          [`${prefix}blue`]: inTargetGroup(metricName, statistic, 0),
          [`${prefix}green`]: inTargetGroup(metricName, statistic, 1),
        },
        label,
        period: cdk.Duration.minutes(1),
      });
    const healthyTasks = bothTargetGroups(
      'HealthyHostCount',
      'Maximum',
      'Healthy tasks',
    );
    const errors = bothTargetGroups(
      'HTTPCode_Target_5XX_Count',
      'Sum',
      '5xx',
      'err',
    );

    const alarm = new cloudwatch.Alarm(this, 'NoHealthyTaskAlarm', {
      alarmDescription: 'No task of ise-quiz-drill passes /api/health',
      metric: healthyTasks,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    // One email when the site goes down and one when it is back. AWS sends a
    // confirmation email first; nothing arrives until it is confirmed.
    const alarmTopic = new sns.Topic(this, 'AlarmTopic');
    if (props.alarmEmail) {
      alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alarmEmail),
      );
    }
    alarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
    alarm.addOkAction(new cloudwatchActions.SnsAction(alarmTopic));

    // The app is up but failing requests. No traffic means no data, which is
    // fine here: an outage is the health alarm's job.
    const errorAlarm = new cloudwatch.Alarm(this, 'ErrorAlarm', {
      alarmDescription: 'ise-quiz-drill answers with 5xx errors',
      metric: errors,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      threshold: 5,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
    errorAlarm.addOkAction(new cloudwatchActions.SnsAction(alarmTopic));

    // One screen for the service: health, traffic, errors, speed, resources
    const ecsMetric = (metricName: string) =>
      new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName,
        // Express Mode puts the service in the default cluster
        dimensionsMap: { ClusterName: 'default', ServiceName: serviceName },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      });
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: serviceName,
      widgets: [
        [
          new cloudwatch.AlarmStatusWidget({
            title: 'Alarms',
            alarms: [alarm, errorAlarm],
            width: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'Healthy tasks',
            left: [healthyTasks],
            width: 9,
          }),
          new cloudwatch.GraphWidget({
            title: 'Requests and 5xx',
            left: [
              bothTargetGroups('RequestCount', 'Sum', 'Requests', 'req'),
              errors,
            ],
            width: 9,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Response time p95 (s)',
            left: [0, 1].map((index) =>
              inTargetGroup('TargetResponseTime', 'p95', index),
            ),
            width: 12,
          }),
          new cloudwatch.GraphWidget({
            title: 'CPU and memory (%)',
            left: [ecsMetric('CPUUtilization'), ecsMetric('MemoryUtilization')],
            width: 12,
          }),
        ],
      ],
    });
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards/dashboard/${dashboard.dashboardName}`,
    });

    // The endpoint may come with or without https://, so drop it and add one
    const host = cdk.Fn.join(
      '',
      cdk.Fn.split('https://', service.attrEndpoint),
    );
    new cdk.CfnOutput(this, 'ServiceUrl', { value: `https://${host}` });
  }
}
