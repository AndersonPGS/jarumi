const status=require('../docs/publication-status.json');
if (!status.publicDistributionApproved) {
 console.error('PUBLIC RELEASE BLOCKED:');
 status.blockers.forEach(item=>console.error('- '+item));
 process.exit(1);
}
console.log('Publication review approved. Complete the release checklist before uploading.');
