import { RowDataPacket } from 'mysql2';
import * as mysql from 'mysql2/promise';
import { DB_HOST, DB_NAME, DB_PWD, DB_USER } from '../var/env.config';
 
const dbConnectionConfig = {
  host: DB_HOST,
  user: DB_USER,
  password: DB_PWD,
  database: DB_NAME
}
// Connections
async function testConnections() {
  let connection = await mysql.createConnection(dbConnectionConfig);

  connection.connect()
    .then(() => connection.query<mysql.RowDataPacket[]>('SELECT 1 + 1 AS solution'))
    .then(([rows, fields]) => {
      console.log('The solution AAA is: ', rows[0]['solution']);
    });

  connection.connect()
    .then(() => connection.execute<mysql.RowDataPacket[]>('SELECT 1 + 1 AS solution'))
    .then(([rows, fields]) => {
      console.log('The solution BBB is: ', rows[0]['solution']);
    });
}

/// Pools

let poolConfig = { connectionLimit: 10, ...dbConnectionConfig}

let pool = mysql.createPool(poolConfig);

async function testPoolConnection() {
  pool.query<mysql.RowDataPacket[]>('SELECT 1 + 1 AS solution')
    .then(([rows, fields]) => {
      console.log('The solution CCC is: ', rows);
    });

  pool.execute<mysql.RowDataPacket[]>('SELECT 1 + 1 AS solution')
    .then(([rows, fields]) => {
      console.log('The solution DDD is: ', rows[0]['solution']);
    });

  const connection = await pool.getConnection();
  // Use the connection
  await connection.ping();
  const rows = await connection.query("SELECT * FROM test");
  console.log('returned rows', rows);
  // And done with the connection.
  connection.release();
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////
export let db_query = async (sql:string, values:any | any[] | { [param: string]: any}="")=> {
  try {
    const connection = await pool.getConnection();
    // Use the connection
    await connection.ping();
    const result = await connection.query(sql, values);
    //console.log('query result', result);
    connection.release();
    return result;
  } catch (error) {
      console.log('===========mysql-error=======:', error);
  }
}
export let db_execute = async (sql:string, values:any | any[] | { [param: string]: any}="") => {
  try {
    const connection = await pool.getConnection();
    // Use the connection
    await connection.ping();
    const result = await connection.execute(sql, values);
    connection.release();
    return result;
  } catch (error) {
      console.log('===========mysql-error=======:', error);
  }
}


// let rows = test_query();
// console.log('rows', rows);
export default pool;
