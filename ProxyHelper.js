const axios = require('axios');
const FormData = require('form-data');

class ProxyHelper {
  constructor() {
    // Initialize properties as needed
    this.originalRequest = null;
    this.multipartParams = [];
    this.headers = null;
    this.authorization = null;
    this.customMethod = null;
    this.addQuery = false;
    this.useDefaultAuth = true;
  }

  createProxy(request, useDefaultAuth = true) {
    this.originalRequest = request;
    this.multipartParams = this.getMultipartParams();
    this.useDefaultAuth = useDefaultAuth;
    return this;
  }

  withHeaders(headers) {
    this.headers = headers;
    return this;
  }

  withBasicAuth(user, secret) {
    this.authorization = { type: 'basic', user, secret };
    return this;
  }

  withDigestAuth(user, secret) {
    this.authorization = { type: 'digest', user, secret };
    return this;
  }

  withToken(token) {
    this.authorization = { type: 'token', token };
    return this;
  }

  withMethod(method = 'POST') {
    this.customMethod = method;
    return this;
  }

  preserveQuery(preserve) {
    this.addQuery = preserve;
    return this;
  }

  async getResponse(url) {
    const info = this.getRequestInfo();
    const axiosInstance = this.createAxios(info.type);
    axiosInstance.defaults.headers = this.setHeaders();
    axiosInstance.defaults = this.setAuth(axiosInstance.defaults, info.token);

    if (this.addQuery && info.query) {
      url = `${url}?${new URLSearchParams(info.query).toString()}`;
    }

    const response = await this.call(axiosInstance, info.method, url, this.getParams(info));

    return {
      data: this.isJson(response) ? response.data : response.data.toString(),
      status: response.status,
    };
  }

  toUrl(url) {
    return this.getResponse(url);
  }

  toHost(host, proxyController) {
    return this.getResponse(`${host}${this.originalRequest.path.replace(proxyController, '')}`);
  }

  getParams(info) {
    let defaultParams = [];
    if (info.method === 'GET') {
      return info.params;
    }
    if (info.type === 'multipart') {
      defaultParams = this.multipartParams;
    } else {
      defaultParams = info.params;
    }
    if (info.query) {
      for (const [key, value] of Object.entries(info.query)) {
        const index = defaultParams.findIndex((param) => param.name === key && param.contents === value);
        if (index !== -1) {
          defaultParams.splice(index, 1);
        }
      }
    }
    return defaultParams;
  }

  setAuth(config, currentAuth = null) {
    if (!this.authorization) {
      return config;
    }
    switch (this.authorization.type) {
      case 'basic':
        config.auth = {
          username: this.authorization.user,
          password: this.authorization.secret,
        };
        return config;
      case 'digest':
        // Implement Digest Auth if needed
        return config;
      case 'token':
        config.headers['Authorization'] = `Bearer ${this.authorization.token}`;
        return config;
      default:
        if (currentAuth && this.useDefaultAuth) {
          config.headers['Authorization'] = `Bearer ${currentAuth}`;
        }
        return config;
    }
  }

  setHeaders() {
    return this.headers || {};
  }

  createAxios(type) {
    const axiosInstance = axios.create();
    switch (type) {
      case 'multipart':
        axiosInstance.defaults.headers['Content-Type'] = 'multipart/form-data';
        return axiosInstance;
      case 'form':
        axiosInstance.defaults.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        return axiosInstance;
      case 'json':
        axiosInstance.defaults.headers['Content-Type'] = 'application/json';
        return axiosInstance;
      default:
        return axiosInstance;
    }
  }

  async call(axiosInstance, method, url, params) {
    if (this.customMethod) {
      method = this.customMethod;
    }
    switch (method) {
      case 'GET':
        return await axiosInstance.get(url, { params });
      case 'HEAD':
        return await axiosInstance.head(url, { params });
      default:
      case 'POST':
        return await axiosInstance.post(url, params);
      case 'PATCH':
        return await axiosInstance.patch(url, params);
      case 'PUT':
        return await axiosInstance.put(url, params);
      case 'DELETE':
        return await axiosInstance.delete(url, { data: params });
    }
  }

  getRequestInfo() {
    return {
      type: this.originalRequest.isJson()
        ? 'json'
        : this.originalRequest.header('Content-Type').includes('multipart')
        ? 'multipart'
        : this.originalRequest.header('Content-Type') === 'application/x-www-form-urlencoded'
        ? 'form'
        : this.originalRequest.header('Content-Type'),
      agent: this.originalRequest.userAgent(),
      method: this.originalRequest.method(),
      token: this.originalRequest.bearerToken(),
      full_url: this.originalRequest.fullUrl(),
      url: this.originalRequest.url(),
      format: this.originalRequest.format(),
      query: this.originalRequest.query(),
      params: this.originalRequest.all(),
    };
  }

  getMultipartParams() {
    const multipartParams = [];
    if (this.originalRequest.isMethod('post')) {
      const formParams = this.originalRequest.all();
      const fileUploads = {};
      for (const [key, param] of Object.entries(formParams)) {
        if (param instanceof HttpUploadedFile) {
          fileUploads[key] = param;
          delete formParams[key];
        }
      }
      if (Object.keys(fileUploads).length > 0) {
        for (const [key, value] of Object.entries(formParams)) {
          multipartParams.push({
            name: key,
            contents: value,
          });
        }
        for (const [key, value] of Object.entries(fileUploads)) {
          multipartParams.push({
            name: key,
            contents: value.createReadStream(),
            filename: value.originalname,
            headers: {
              'Content-Type': value.mimetype,
            },
          });
        }
      }
    }
    return multipartParams;
  }

  isJson(response) {
    return response.headers['content-type'].includes('json');
  }
}

module.exports = ProxyHelper;
