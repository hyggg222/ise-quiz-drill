import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ServiceRolesStack } from '../lib/service-roles-stack';
import { ServiceStack } from '../lib/service-stack';

const env = { account: '123456789012', region: 'eu-west-1' };

const template = (imageTag = 'abc1234', alarmEmail?: string) => {
  const app = new cdk.App();
  const roles = new ServiceRolesStack(app, 'TestRolesStack', { env });
  return Template.fromStack(
    new ServiceStack(app, 'TestServiceStack', {
      env,
      imageTag,
      roles,
      alarmEmail,
    }),
  );
};

// Works out a CloudFormation value, with every GetAtt given as the endpoint
type Cfn = string | Cfn[] | { [fn: string]: Cfn };
const resolve = (value: Cfn, endpoint: string): string | string[] => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.map((v) => resolve(v, endpoint) as string);
  const [[fn, args]] = Object.entries(value) as [string, Cfn[]][];
  if (fn === 'Fn::GetAtt') return endpoint;
  if (fn === 'Fn::Split')
    return (resolve(args[1], endpoint) as string).split(args[0] as string);
  if (fn === 'Fn::Join') {
    const parts = resolve(args[1], endpoint);
    return (Array.isArray(parts) ? parts : [parts])
      .flat()
      .join(args[0] as string);
  }
  throw new Error(`cannot resolve ${fn}`);
};

describe('ServiceStack', () => {
  test('runs the image tag it is given from the project repository', () => {
    template('9f8e7d6').hasResourceProperties(
      'AWS::ECS::ExpressGatewayService',
      {
        ServiceName: 'ise-quiz-drill',
        PrimaryContainer: Match.objectLike({
          Image:
            '123456789012.dkr.ecr.eu-west-1.amazonaws.com/ise-quiz-drill:9f8e7d6',
          ContainerPort: 4321,
        }),
      },
    );
  });

  test('checks the app health endpoint', () => {
    template().hasResourceProperties('AWS::ECS::ExpressGatewayService', {
      HealthCheckPath: '/api/health',
    });
  });

  test('runs one small task and scales to two at most', () => {
    template().hasResourceProperties('AWS::ECS::ExpressGatewayService', {
      Cpu: '256',
      Memory: '512',
      ScalingTarget: { MinTaskCount: 1, MaxTaskCount: 2 },
    });
  });

  // A failed deploy rolls this stack back; the roles must outlive it so ECS
  // can still clean up the service it started
  test('uses roles from the roles stack instead of creating its own', () => {
    const t = template();
    t.resourceCountIs('AWS::IAM::Role', 0);
    t.hasResourceProperties('AWS::ECS::ExpressGatewayService', {
      InfrastructureRoleArn: { 'Fn::ImportValue': Match.anyValue() },
      ExecutionRoleArn: { 'Fn::ImportValue': Match.anyValue() },
    });
  });

  describe('health alarm', () => {
    const alarm = () => {
      const alarms = template().findResources('AWS::CloudWatch::Alarm');
      expect(Object.keys(alarms)).toHaveLength(1);
      return Object.values(alarms)[0].Properties;
    };
    const healthyHostMetrics = () =>
      (alarm().Metrics as { MetricStat?: { Metric: { MetricName: string } } }[])
        .filter((m) => m.MetricStat)
        .map((m) => m.MetricStat!.Metric.MetricName);

    // Express Mode rolls out a canary across two target groups, so the alarm
    // must count healthy tasks in both or it goes blind after each deploy
    test('counts healthy tasks across both target groups', () => {
      expect(healthyHostMetrics()).toEqual([
        'HealthyHostCount',
        'HealthyHostCount',
      ]);
    });

    test('fires after three minutes with no healthy task', () => {
      expect(alarm()).toMatchObject({
        ComparisonOperator: 'LessThanThreshold',
        Threshold: 1,
        EvaluationPeriods: 3,
        DatapointsToAlarm: 3,
      });
    });

    test('treats missing data as unhealthy', () => {
      expect(alarm().TreatMissingData).toBe('breaching');
    });

    // One message when the site goes down and one when it is back
    test('notifies an SNS topic when it fires and when it recovers', () => {
      const t = template();
      t.resourceCountIs('AWS::SNS::Topic', 1);
      const topic = { Ref: Object.keys(t.findResources('AWS::SNS::Topic'))[0] };
      expect(alarm().AlarmActions).toEqual([topic]);
      expect(alarm().OKActions).toEqual([topic]);
    });

    test('emails the topic when an address is given', () => {
      template('abc1234', 'owner@example.com').hasResourceProperties(
        'AWS::SNS::Subscription',
        { Protocol: 'email', Endpoint: 'owner@example.com' },
      );
    });

    test('adds no subscription without an address', () => {
      template().resourceCountIs('AWS::SNS::Subscription', 0);
    });
  });

  // AWS gave the endpoint without a scheme, then started adding https://
  test.each(['is-1.ecs.eu-west-1.on.aws', 'https://is-1.ecs.eu-west-1.on.aws'])(
    'outputs one https:// for the endpoint %s',
    (endpoint) => {
      const output = template().toJSON().Outputs.ServiceUrl.Value;
      expect(resolve(output, endpoint)).toBe(
        'https://is-1.ecs.eu-west-1.on.aws',
      );
    },
  );
});
