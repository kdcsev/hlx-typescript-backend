import { Logger } from '../library/logger';
import { Curl, curly } from 'node-libcurl';
import * as querystring from 'query-string';

export const curl_get = async (url: string) => {
  const options = {
    sslVerifyPeer:false,
    sslVerifyHost:0,
    verbose: 1
  }
  const { statusCode, data, headers } = await curly.get(url, options);
  return { statusCode, data, headers };
}

export const curl_post = async (url: string, params: any = {}) => {
  try{
    const options = {
      sslVerifyPeer:false,
      sslVerifyHost:0,
      verbose: 1,
      postFields: querystring.stringify(params)
    }
    const { statusCode, data, headers } = await curly.post(url, options)
    return { statusCode, data, headers };
  }catch(e){
    Logger.error(e);
    return { statusCode:500, data:{}, headers:{}};
  }
  
}

export const curl_post_json = async (url: string, params: any = {}) => {
  const options = {
    sslVerifyPeer:false,
    sslVerifyHost:0,
    verbose: 1,
    postFields: querystring.stringify(params),
    httpHeader: [
      'Content-Type: application/json',
      'Accept: application/json'
    ]
  }
  const { statusCode, data, headers } = await curly.post(url, options)
  return { statusCode, data, headers };
}

export const curl_form_urlencoded = (url: string, params: any = {}) => {
  const curl = new Curl();
  const close = curl.close.bind(curl);
  const header = [
    'Content-Type: application/json',
    'Accept: application/json'
  ]
  curl.setOpt(Curl.option.HTTPHEADER, header);
  curl.setOpt(Curl.option.URL, url);
  curl.setOpt(Curl.option.POST, true)
  curl.setOpt(Curl.option.SSL_VERIFYPEER, false)
  curl.setOpt(Curl.option.SSL_VERIFYHOST, 0)  
  curl.setOpt(Curl.option.VERBOSE, 1 );
  curl.setOpt(Curl.option.POSTFIELDS, querystring.stringify(params));
  curl.on('end', function (statusCode, data, headers) {
    console.info(statusCode);
    console.info('---');
    console.info(data);
    console.info('---');
    console.info(this.getInfo( 'TOTAL_TIME'));
    this.close();
  });
  curl.on('error', close);
  curl.perform();
}

