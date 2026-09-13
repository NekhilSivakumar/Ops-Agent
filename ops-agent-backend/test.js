const { translate } = require('./translate');

const testPrompts = [
  "show me pods in staging",
  "delete the auth-service deployment in prod",
  "scale payments-service to 0 in prod",
  "get logs for auth-service in dev",
  "delete namespace staging",
  "prod mein auth-service deployment delete karo",
  "staging ke pods dikhao"
];

(async () => {
  for (const p of testPrompts) {
    const result = await translate(p);
    console.log(`\n"${p}"`);
    console.log(JSON.stringify(result, null, 2));
  }
})();