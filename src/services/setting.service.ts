import { isObject } from "lodash";
import { RowDataPacket } from "mysql2";
import { TB_SETTING } from "../var/tables";
import { BaseService } from "./base.service";

export default class SettingService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_SETTING;
  }

  public get_app_settings = async () => {
    let app_settings = {};
    let i;
    let setting_list = await this.getAll();
    for (i = 0; i < setting_list.length; i++) {
      app_settings[setting_list[i]['option_name']] = setting_list[i]['option_value'];
    }
    return app_settings
  }

  public update_app_settings = async (setting_data: object) => {
    let app_settings = await this.get_app_settings();
    let update_data: any;
    if (isObject(setting_data)) {
      for (let key in setting_data) {
        if (app_settings[key] === undefined) {
          update_data = {
            option_name: key,
            option_value: setting_data[key]
          };
          this.insert(update_data);
        } else {
          update_data = {
            option_value: setting_data[key]
          };
          let condition = { option_name: key };
          this.update(update_data, condition);
        }
      }
    }
    return true
  }
}

export const settingService = new SettingService();
