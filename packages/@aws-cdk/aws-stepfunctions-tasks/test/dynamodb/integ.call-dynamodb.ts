import * as ddb from '@aws-cdk/aws-dynamodb';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as tasks from '../../lib';

/**
 *
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * *
 * * aws stepfunctions describe-execution --execution-arn <execution-arn generated before> --query 'status': should return status as SUCCEEDED
 * * aws stepfunctions describe-execution --execution-arn <execution-arn generated before> --query 'output': should return the number 42
 */
class CallDynamoDBStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);

    const TABLE_NAME = 'Messages';
    const MESSAGE_ID = '1234';
    const firstNumber = 18;
    const secondNumber = 24;

    const table = new ddb.Table(this, 'Messages', {
      tableName: TABLE_NAME,
      partitionKey: {
        name: 'MessageId',
        type: ddb.AttributeType.STRING,
      },
      readCapacity: 10,
      writeCapacity: 5,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const putItemTask = new tasks.DynamoPutItem(this, 'PutItem', {
      item: {
        MessageId: { s: MESSAGE_ID },
        Text: { s: sfn.Data.stringAt('$.bar') },
        TotalCount: { n: `${firstNumber}` },
      },
      table,
    });

    const getItemTaskAfterPut = new tasks.DynamoGetItem(this, 'GetItemAfterPut', {
      partitionKey: {
        name: 'MessageId',
        value: { s: MESSAGE_ID },
      },
      table,
    });

    const updateItemTask = new tasks.DynamoUpdateItem(this, 'UpdateItem', {
      partitionKey: {
        name: 'MessageId',
        value: { s: MESSAGE_ID },
      },
      table,
      expressionAttributeValues: {
        ':val': { n: sfn.Data.stringAt('$.Item.TotalCount.N') },
        ':rand': { n: `${secondNumber}` },
      },
      updateExpression: 'SET TotalCount = :val + :rand',
    });

    const getItemTaskAfterUpdate = new tasks.DynamoGetItem(this, 'GetItemAfterUpdate', {
      partitionKey: {
        name: 'MessageId',
        value: { s: MESSAGE_ID },
      },
      table,
      outputPath: sfn.Data.stringAt('$.Item.TotalCount.N'),
    });

    const deleteItemTask = new tasks.DynamoDeleteItem(this, 'DeleteItem', {
      partitionKey: {
        name: 'MessageId',
        value: { s: MESSAGE_ID },
      },
      table,
      resultPath: 'DISCARD',
    });

    const definition = new sfn.Pass(this, 'Start', {
      result: sfn.Result.fromObject({ bar: 'SomeValue' }),
    })
      .next(putItemTask)
      .next(getItemTaskAfterPut)
      .next(updateItemTask)
      .next(getItemTaskAfterUpdate)
      .next(deleteItemTask);

    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definition,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
    });
  }
}

const app = new cdk.App();
new CallDynamoDBStack(app, 'aws-stepfunctions-integ');
app.synth();
