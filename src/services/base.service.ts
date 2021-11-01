import { db_execute, db_query } from "../database/db";
import { isObject, isString } from "lodash";
import { RowDataPacket } from "mysql2";
import * as mysql from 'mysql2/promise';
import { empty } from "../helpers/misc";

export abstract class BaseService {
  public tableName = "test";
  constructor() {

  }
  protected setTableName = (tableName: string): void => {
    this.tableName = tableName;
  }

  // get all rows from table
  public getAll = async (condition?: object | string | any, order?: object | string) => {
    let sql = "select * from " + this.tableName + " where 1=1";
    let values = [];
    if (isObject(condition)) {
      Object.keys(condition).map(function (key: any, index: any) {
        sql += " and " + key + "=?";
        values.push(condition[key]);
      })
    } else if (isString(condition)) {
      sql += condition;
    }
    if(!empty(order)){
      sql += " order by " + order;
    }
    //console.log('sql', sql, values);
    const [rows, defs] = <RowDataPacket[]> await db_query(sql, values);
    return rows;
  }

  //get one row from table
  public getOne = async (condition?: object | string | any) => {
    let sql = "select * from " + this.tableName + " where 1=1";
    let values = [];
    if (isObject(condition)) {
      Object.keys(condition).map(function (key: any, index: any) {
        sql += " and " + key + "=?";
        values.push(condition[key]);
      })
    } else if (isString(condition)) {
      sql += condition;
    }
    sql += " limit 0,1";
    //console.log('sql', sql, values);
    const [rows, defs] = <RowDataPacket[]> await db_query(sql, values);
    let row = !empty(rows) ? rows[0] : false;
    return row;
  }

  //update table data
  public update = async (data?: object | string | any, condition?: object | string | any) => {
    let set_data = "";
    let set_arr: string[] = [];
    let values = [];

    if (isObject(data)) {
      Object.keys(data).map(function (key: any, index: any) {
        set_arr.push(key + "=?");
        values.push(data[key]);
      });
      if (set_arr.length > 0) {
        set_data = set_arr.join(", ");
      }
    } else if (isString(data)) {
      set_data += condition;
    }

    let sql = "update " + this.tableName + " set " + set_data + " where 1=1";
    if (isObject(condition)) {
      Object.keys(condition).map(function (key: any, index: any) {
        sql += " and " + key + "=?";
        values.push(condition[key]);
      })
    } else if (isString(condition)) {
      sql += condition;
    }
    //console.log('sql', sql, values);
    const [resultRetHeader] = await db_query(sql, values);
    return resultRetHeader;
  }

  //insert table data
  public insert = async (data: object) => {
    let set_data = "";
    let set_arr: string[] = [];
    let values = [];

    let key_list = []
    if (isObject(data)) {
      Object.keys(data).map(function (key: any, index: any) {
        key_list.push("`"+key+"`")
        set_arr.push("?");
        values.push(data[key]);
      });
    }

    let sql = "insert into " + this.tableName + " ("+ key_list.join(',') +") values ("+ set_arr.join(',') +")";
    //console.log('insert sql', sql, values);
    const [resultRetHeader] = await db_query(sql, values);
    //console.log('resultRetHeader', resultRetHeader);
    let insertId = (!empty(resultRetHeader) ? resultRetHeader['insertId'] : false);
    return insertId;
  }

  //delete row
  public delete = async (condition?: object | string | any) => {
    let sql = "delete from " + this.tableName + " where 1=1";
    let values = [];
    if (isObject(condition)) {
      Object.keys(condition).map(function (key: any, index: any) {
        sql += " and " + key + "=?";
        values.push(condition[key]);
      })
    } else if (isString(condition)) {
      sql += condition;
    }
    //console.log('sql', sql, values);
    const [resultRetHeader] = await db_query(sql, values);
    let affectedRows = (!empty(resultRetHeader) ? resultRetHeader['affectedRows'] : false);
    return affectedRows;
  }

  public countAll = async (condition?: object | string | any) => {
    let sql = "select count(id) as cnt from " + this.tableName + " where 1=1";
    let values = [];
    if (isObject(condition)) {
      Object.keys(condition).map(function (key: any, index: any) {
        sql += " and " + key + "=?";
        values.push(condition[key]);
      })
    } else if (isString(condition)) {
      sql += condition;
    }
    //console.log('sql', sql, values);
    const [rows, defs] = await db_query(sql, values);
    let cnt = (!empty(rows) ? rows[0]['cnt'] : false);
    return cnt;
  }

  public query = async (sql:string, values:any=[]) => {
    //sql = mysql.escape(sql);
    //console.log('escaped', sql);
    const [rows] = await db_query(sql, values);
    return rows;
  }

}

export default BaseService;
