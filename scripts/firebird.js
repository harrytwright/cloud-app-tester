const path = require('path')

const Firebird = require('node-firebird');

let options = {};

options.host = '127.0.0.1';
options.port = 3050;
options.database = path.resolve(process.cwd(), process.argv[2]);
options.user = 'SYSDBA';
options.password = 'masterkey';

Firebird.attach(options, function(err, db) {

  if (err)
    throw err;

  // db = DATABASE
  db.query('SELECT * FROM TABLE', function(err, result) {
    // IMPORTANT: close the connection
    db.detach();
  });

});
