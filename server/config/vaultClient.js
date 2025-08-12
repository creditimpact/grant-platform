import Vault from 'node-vault';

const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN, // הטוקן ייקרא מ־env variables
});

export default vault;
