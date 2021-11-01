import { curl_post } from "../helpers/curl";
import { DOMParser } from "xmldom";

import { NMI_IS_LIVE, WHM_FUNC } from "../var/env.config";
import { base64_encode, empty, get_data_value, is_null, number_format, serialize, trim_phone } from "../helpers/misc";
import { Logger } from "./logger";
import { vpsOrderQueueService } from "../services/vps.order.queue.service";

export default class Whm {
    public api_url: string;
    public apiusername: string;
    public apipassword: string;
    public pid: string | number;
    constructor() {
        this.api_url = "https://portal.higherlevelfx.com/includes/api.php"; // "https://fivestarvps.com/billing/includes/api.php";
        this.apiusername = "8Tvoc59vQdgF5T1GMPaK1cnKibruP44L";// "F17pGEEyClk9Q0C1fpjNtL3jbouFHcnO";
        this.apipassword = "01qtzzc8x0XYZMu46OVkbaBz58JWVYrg";// "nMAsqQmQ2lmnHuCUi3wdOU1k6GW2CPct";
        this.pid = 1;
    }


    /************************* Main functions ********************************/
    public checkClientExist = async (email) => { //check if client already exists or not,  if exist return client_info, else return false
        let post_data = {
            action: 'GetClientsDetails',
            username: this.apiusername,
            password: this.apipassword,
            email: email,
            stats: true,
            responsetype: 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        try{
            let response_obj = data
            if (response_obj['result'] == 'success') {
                let client = response_obj['client'];
                let userid = parseInt(client['userid']);
                let client_id = parseInt(client['client_id']);
                return client;
            }
        }catch(e){
            Logger.error(e);
        }
        return false;
    }

    public createClientAndOrder = async (user_info: any) => { //will be called when user signup newly or become an active customer newly
        const [result, clientid] = await this.addClient(user_info);
        if (!result) {
            return [result, clientid];
        } else {
            return await this.addOrderFromClientID(clientid);
        }
    }
    public addOrderFromClientID = async (clientid) => {
        //return array(true, '');
        // Use Remote VPS product ID
        let pid = this.pid;
        let url = this.api_url;

        let postfields = { 'responsetype': 'json' };
        postfields["username"] = this.apiusername;
        postfields["password"] = this.apipassword;
        postfields["action"] = "AddOrder";
        postfields["clientid"] = clientid;
        postfields["pid"] = pid;
        postfields["noemail"] = true;
        //postfields["domain"] = $domain;
        //postfields["domaintype"] = $domaintype;
        //postfields["billingcycle"] = $billingcycle;
        postfields["paymentmethod"] = 'paypalcheckout';
        //postfields["ipaddress"] = $ipaddress;
        let customfields = {
            "3": "Windows",
            "2": "London Datacenter",
            "4": "HLX-VPS"
        }
        postfields["customfields"] = base64_encode(serialize(customfields));
        const { statusCode, data, headers } = await curl_post(this.api_url, postfields)
        let results = data
        if (results["result"] == "success") {
            let orderid = results['orderid'];
            await this.addOrderQueue(orderid);
            return [true, results];
        } else {
            return [false, "An error occured placing your order. Please contact support. (" + results['message'] + ")"]
        }
    }
    public addOrderQueue = async (orderid) => {
        let row = {
            orderid: orderid
        }
        let id = await vpsOrderQueueService.insert(row);
        return id;
    }
    public addClient = async (user_info) => {
        //return array(true, '');
        // Use Remote VPS product ID
        let pid = this.pid;
        let url = this.api_url;

        // Submit Order
        let postfields = { 'responsetype': 'json' };
        postfields["username"] = this.apiusername;
        postfields["password"] = this.apipassword;
        postfields["action"] = "addclient";
        postfields["firstname"] = get_data_value(user_info, 'user_name', 'firstname');
        postfields["lastname"] = get_data_value(user_info, 'user_name', 'lastname');
        postfields["companyname"] = 'HLX';
        postfields["email"] = get_data_value(user_info, 'user_email', 'email');
        postfields["address1"] = get_data_value(user_info, 'billing_street', 'address1');
        postfields["address2"] = get_data_value(user_info, 'billing_street', 'address2');
        postfields["city"] = get_data_value(user_info, 'billing_city', 'city');
        postfields["state"] = get_data_value(user_info, 'billing_state', 'state');
        postfields["postcode"] = get_data_value(user_info, 'billing_zip_code', '');
        postfields["country"] = get_data_value(user_info, 'billing_country', 'US');
        postfields["phonenumber"] = trim_phone(get_data_value(user_info, 'user_phone'));
        if (postfields["phonenumber"] == "") {
            postfields["phonenumber"] = "1234567890";//
        }
        postfields["password2"] = get_data_value(user_info, 'user_password', 'password');

        if (postfields["address1"] == '') {
            postfields["address1"] = 'address1';
        }
        if (postfields["address2"] == '') {
            postfields["address2"] = 'address2';
        }
        if (postfields["city"] == '') {
            postfields["city"] = 'city';
        }
        if (postfields["state"] == '') {
            postfields["state"] = 'state';
        }
        if (postfields["postcode"] == '') {
            postfields["postcode"] = '10001';
        }
        if (postfields["country"] == '') {
            postfields["country"] = 'US';
        }
        /*if(postfields["phonenumber"]== ''){
            postfields["phonenumber"] = '1234567890';
        }*/
        postfields["phonenumber"] = '1234567890';

        if (postfields["password2"] == '') {
            postfields["password2"] = '123456';
        }
        postfields["noemail"] = true;

        //print_r($postfields);
        const { statusCode, data, headers } = await curl_post(this.api_url, postfields)
        //console.log('vps: statusCode, data, headers', statusCode, data, headers);
        //console.log('vps: data-stringfy', JSON.stringify(data));
        //console.log("data-clientid", data['clientid'])
        let results = data;

        if (results["result"] == "success") {
            let clientid = results["clientid"];
            return [true, clientid]
        }
        else {
            return [false, "An error occured creating your user account. Please contact support. (" + results['message'] + ")"]
        }
    }

    /************************* Main functions ********************************/
    public getServiceId = async (email: string) => { //
        //get client detail => get order => get service id
        let output_data = {
            result: false,
            client: {},
            order: {},
            serviceid: '',
        };
        let client = await this.checkClientExist(email);
        if (empty(client)) {
            output_data['client'] = false;
            return output_data;
        } else {
            output_data['client'] = client;
        }
        let userid = parseInt(client['userid']);
        let client_id = parseInt(client['client_id']);
        let post_data = {
            'h': 'getorder',
            'action': 'GetOrders',
            'username': this.apiusername,
            'password': this.apipassword,
            'userid': userid,
            'responsetype': 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data;
        //print_r($response_obj);
        if (response_obj['result'] == 'success') {
            try {
                if (!empty(response_obj['orders']['order'][0]['lineitems']['lineitem'][0])) {
                    let order = response_obj['orders']['order'][0]['lineitems']['lineitem'][0];
                    let serviceid = order['relid'];
                    output_data['result'] = true;
                    output_data['order'] = response_obj['orders']['order'][0];
                    output_data['serviceid'] = serviceid;
                    return output_data;
                }
            } catch (error) {
                console.log('error', error);
                return output_data;
            }
        }
        return output_data;
    }
    /************************* Main functions ********************************/
    public moduleTerminate = async (email: string) => {
        //return array(true, '');
        let info = await this.getServiceId(email);
        if (info['result'] === false) {
            if (empty(info['client'])) {
                return [false, "Client does not exist"]
            } else {
                return [false, "Order does not exist"]
            }
        }
        let service_id = info['serviceid'];
        let post_data = {
            'action': 'ModuleTerminate',
            'username': this.apiusername,
            'password': this.apipassword,
            'serviceid': service_id,
            'responsetype': 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data
        return [true, response_obj]
    }
    /************************* Main functions ********************************/
    public moduleCreate = async (email: string) => {
        //return array(true, '');
        let info = await this.getServiceId(email);
        if (info['result'] === false) {
            if (empty(info['client'])) {
                return [false, "Client does not exist"]
            } else {
                return [false, "Order does not exist"]
            }
        }
        let service_id = info['serviceid'];
        let post_data = {
            'action': 'ModuleCreate',
            // See https://developers.whmcs.com/api/authentication
            'username': this.apiusername,
            'password': this.apipassword,
            'serviceid': service_id,
            'responsetype': 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data
        return [true, response_obj]
    }

    public getClientsProducts = async (email: string) => {
        let client = await this.checkClientExist(email);
        //print_r($client);
        if (!empty(client)) {
            let client_id = client['client_id'];
            let post_data = {
                'action': 'GetClientsProducts',
                'username': this.apiusername,
                'password': this.apipassword,
                'clientid': client_id,
                'stats': true,
                'responsetype': 'json'
            }
            const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
            let response_obj = data
            //print_r($response_obj);
            if (response_obj['result'] == 'success') {
                if (!empty(response_obj['products']['product'][0])) {
                    let product = response_obj['products']['product'][0];
                    //print_r($product);
                    return product;
                }
            } else {
                let message = get_data_value(response_obj, 'message');
            }
        }
        return false;
    }

    public createSsoToken = async (email: string) => {
        //return array(true, '');
        let info = await this.getServiceId(email);
        if (info['result'] === false) {
            if (empty(info['client'])) {
                return [false, "Client does not exist"]
            } else {
                return [false, "Order does not exist"]
            }
        }
        let service_id = info['serviceid'];
        let client = info['client'];
        let client_id = client['client_id'];
        let post_data = {
            'action': 'CreateSsoToken',
            'username': this.apiusername,
            'password': this.apipassword,
            'client_id': client_id,
            'destination': 'clientarea:product_details',
            'service_id': service_id,
            'responsetype': 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data
        if (response_obj['result'] == 'success') {
            return [true, response_obj]
        } else {
            let message = get_data_value(response_obj, 'message');
            return [false, message]
        }
    }

    public acceptOrder = async (orderid: string | number) => {
        if(WHM_FUNC === 'disabled'){
            return [true, '']
        }
        let post_data = {
            'action': 'AcceptOrder',
            'username': this.apiusername,
            'password': this.apipassword,
            'orderid': orderid,
            'registrar': 'enom',
            'autosetup': true,
            'sendemail': false,
            'responsetype': 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data
        let result = get_data_value(response_obj, 'result');
        if (result == 'success') {
            return [true, 'success']
        } else {
            return [false, data]
        }
    }


    /*
     * user_id : user_id of whm
     * user_info: {firstname:'firstname', lastname:'lastname', email: 'email'}
     *
     * */

    public updateUser = async (vps_order_detail: object, user_info: object) => {
        let user_id = get_data_value(vps_order_detail['client'], 'userid');
        if (empty(user_info)) {
            return [false, '']
        }
        let post_data = {
            'action': 'UpdateUser',
            'username': this.apiusername,
            'password': this.apipassword,
            'user_id': user_id,
            'responsetype': 'json',
        }
        if (!is_null(user_info['firstname'])) {
            post_data['firstname'] = user_info['firstname'];
        }
        if (!is_null(user_info['lastname'])) {
            post_data['lastname'] = user_info['lastname'];
        }
        if (!is_null(user_info['email'])) {
            post_data['email'] = user_info['email'];
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data
        let result = get_data_value(response_obj, 'result');
        if (result == 'success') {
            //update client info
            let client_id = get_data_value(vps_order_detail['client'], 'client_id');
            return await this.updateClientInfo(client_id, user_info)
        } else {
            return [false, get_data_value(response_obj, 'message')]
        }
    }
    public updateClientInfo = async (client_id: number | string, user_info: object) => {
        let post_data = {
            'action': 'UpdateClient',
            'username': this.apiusername,
            'password': this.apipassword,
            'clientid': client_id,
            'email': user_info['email'],
            'responsetype': 'json'
        }
        const { statusCode, data, headers } = await curl_post(this.api_url, post_data)
        let response_obj = data
        let result = get_data_value(response_obj, 'result');
        if (result == 'success') {
            return [true, 'success']
        } else {
            return [false, get_data_value(response_obj, 'message')]
        }
    }
}

export const whm = new Whm()