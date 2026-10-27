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

    const service = new ecs.CfnExpressGatewayService(this, 'Service', {
      serviceName: 'ise-quiz-drill',
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

    // Express Mode rolls out a canary across two target groups; add both so
    // the alarm sees healthy tasks whichever one is live
    const healthyIn = (index: number) =>
      new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HealthyHostCount',
        dimensionsMap: {
          LoadBalancer: loadBalancer,
          TargetGroup: afterLastColon(cdk.Fn.select(index, targetGroups)),
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      });

    const alarm = new cloudwatch.Alarm(this, 'NoHealthyTaskAlarm', {
      alarmDescription: 'No task of ise-quiz-drill passes /api/health',
      metric: new cloudwatch.MathExpression({
        expression: 'FILL(blue, 0) + FILL(green, 0)',
        usingMetrics: { blue: healthyIn(0), green: healthyIn(1) },
        label: 'Healthy tasks',
        period: cdk.Duration.minutes(1),
      }),
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

    // The endpoint may come with or without https://, so drop it and add one
    const host = cdk.Fn.join(
      '',
      cdk.Fn.split('https://', service.attrEndpoint),
    );
    new cdk.CfnOutput(this, 'ServiceUrl', { value: `https://${host}` });
  }
}
