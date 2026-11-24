const password = process.env.MONGO_APP_PASSWORD;
if (!password) {
  throw new Error('MONGO_APP_PASSWORD is required');
}

db.getSiblingDB('muvilite').createUser({
  user: 'muvilite',
  pwd: password,
  roles: [{ role: 'readWrite', db: 'muvilite' }],
});
