import { curl_post, curl_post_json } from "../helpers/curl";
import xmlbuilder = require("xmlbuilder");
import { DOMParser } from "xmldom";
import * as querystring from 'query-string';

import { NMI_IS_LIVE, NMI_LIVE_SECRET_KEY, NMI_TEST_SECRET_KEY } from "../var/env.config";
import { number_format } from "../helpers/misc";
import { Logger } from "./logger";

/////NMI library for nodejs
const GW_APPROVED = 1;
const GW_DECLINED = 1;
const GW_ERROR = 1;

export default class Nmi {
    public live_mode: boolean;
    public gateway_info: object = {};
    public billing: object = {};
    public shipping: object = {};
    public order: object = {};
    constructor() {
        console.log('NMI_IS_LIVE', NMI_IS_LIVE)
        this.live_mode = NMI_IS_LIVE === "true";
        let gateway_info = {
            security_key: NMI_TEST_SECRET_KEY,
            gatewayURL: 'https://secure.nmi.com/api/v2/three-step'
        };

        if (this.live_mode) {
            gateway_info = {
                security_key: NMI_LIVE_SECRET_KEY,
                gatewayURL: 'https://secure.nmi.com/api/v2/three-step'
            };
        }
        this.gateway_info = gateway_info;
    }
    public get_form_url = (form_data?: object): void => {
        let root = xmlbuilder.create('root',
            { version: '1.0', encoding: 'UTF-8', standalone: true },
            { pubID: null, sysID: null },
            {
                keepNullNodes: false, keepNullAttributes: false,
                headless: false, ignoreDecorators: false,
                separateArrayItems: false, noDoubleEncoding: false,
                noValidation: false, invalidCharReplacement: undefined,
                stringify: {}
            });
        console.info(root)
    }

    public setBilling = (form_data?: object): void => {
        let default_form_data:object = {
            firstname:"",
            lastname:"",
            company:"",
            address1:"",
            address2:"",
            city:"",
            state:"",
            zip:"",
            country:"",
            phone:"",
            fax:"",
            email:"",
            website:""
        }
        this.billing = {...default_form_data, ...form_data}
    }
    public setShipping = (form_data?: object): void => {
        let default_form_data:object = {
            shipping_firstname:"",
            shipping_lastname:"",
            shipping_company:"",
            shipping_address1:"",
            shipping_address2:"",
            shipping_city:"",
            shipping_state:"",
            shipping_zip:"",
            shipping_country:"",
            shipping_email:""
        }
        this.shipping = {...default_form_data, ...form_data}
    }
    public setOrder = (form_data?: object): void => {
        let default_form_data:object = {
            ipaddress:"",
            orderid:"",
            orderdescription:"",
            tax:"",
            shipping:"",
            ponumber:""
        }
        this.order = {...default_form_data, ...form_data}
    }
    public doSale = async (card_info:object) => {
        const gateway_info = this.gateway_info;
        let params: object = {
            security_key: gateway_info['security_key'],
            ccnumber: card_info['ccnumber'],
            ccexp: card_info['ccexp'],
            cvv: card_info['cvv'],
            amount: number_format(card_info['amount'], 2, ".", ""),
            type:"sale"
        };
        let post_params: object = { ...params, ...this.billing, ...this.shipping, ...this.order };
        const[payment_result, response_data] = await this._doPost(post_params);
        return [payment_result, response_data]
    }

    public _doPost = async (params: object) => {
        const api_url: string = "https://secure.nmi.com/api/transact.php"
        const { statusCode, data, headers } = await curl_post(api_url, params);
        //console.log('----{ statusCode, data, headers }-----', statusCode, data, headers)
        Logger.debug("statusCode: " + statusCode);
        Logger.debug("NMI res data: " + data);
        //return { statusCode, data, headers }
        try{
            if(statusCode === 200) {
                let response_str = data
                console.log('response_data', response_str);   
                let obj = querystring.parse(response_str);
                console.log('payment obj', obj);
                let response_status = obj.response;
                if(response_status === '1') {
                    return [true, {...obj, livemode: this.live_mode}]
                }else{
                    return [false, obj.responsetext]
                }
            }
            return [false, "Payment failed"]
        }catch(e){
            return [false, "Payment failed"]
        }
    }


}

export const nmi = new Nmi()