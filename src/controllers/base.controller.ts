import { Request, Response } from 'express'

interface ReqResObj {
    req: Request;
    res: Response;
}

export default class BaseController {
    public req: Request;
    public res: Response;
    constructor() {

    }
    protected setReqRes = (reqResObj: ReqResObj): void => {
        if (reqResObj.req) {
            this.req = reqResObj.req;
        }
        if (reqResObj.res) {
            this.res = reqResObj.res;
        }
    }

    protected json_output_data = (data: any, message: string = "") => {
        let res = this.res;
        try {
            res.json({ status: '1', data: data, message: message })
        } catch (error) {
            console.log('error', error);
        }
        return true
        //process.exit()
    }
    protected json_output_error = (message: string = "Invalid request", data: any = {}) => {
        try {
            this.res.json({ status: '0', message: message, data: data })
        } catch (error) {
            console.log('error', error);
        }
        return true
        //process.exit()
    }

    protected get_ip = (): string => {
        let request = this.req;
        let ip: string = request.connection.remoteAddress;
        ip = ip.split(',')[0];
        let a = ip.split(':').slice(-1)[0] as string; //in case the ip returned in a format: "::ffff:146.xxx.xxx.xxx"
        return a;
    }

}
