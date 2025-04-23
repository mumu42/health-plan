import { get, post, upload } from '@/utils/request';

/**
 * 测试接口
 */
export function test(): Promise<any> {
    return get('/test')
}

export function login(data?: object): Promise<any> {
    return post('/login', data)
}

// get('/test')
//   .then(res => console.log(res.data))
//   .catch(err => console.error(err));

// // POST请求示例
// post<{ success: boolean }>('/user/login', { username: 'admin', password: '123456' })
//   .then(res => console.log(res.success))
//   .catch(err => console.error(err));

// // 文件上传示例
// upload<{ url: string }>('/upload', 'path/to/file', { description: 'test' })
//   .then(res => console.log(res.url))
//   .catch(err => console.error(err));