import { ClaraFlowRunner } from 'clara-flow-sdk';

console.log('✅ Successfully imported ClaraFlowRunner:', typeof ClaraFlowRunner);

const runner = new ClaraFlowRunner({
  enableLogging: true,
  logLevel: 'info'
});

console.log('✅ Successfully created runner instance');
console.log('✅ Available node types:', runner.getAvailableNodeTypes());
console.log('🎉 Clara Flow SDK is working perfectly!'); 