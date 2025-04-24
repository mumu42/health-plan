import { get, post, upload } from '@/utils/request';

/**
 * 登录接口
 * @param data 登录信息
 * @returns Promise<any> 登录结果
 * */
export function login(data?: object): Promise<any> {
    return post('/login', data)
}

/**
 * 打卡
 * @param data { userId, groupId, status, notes }
 * @returns 
 */
export function checkIn(data?: object): Promise<any> {
    return post('/checkin', data)
}

/**
 * 打卡记录
 * @param data { userId: string }
 * @returns Promise<any>
 * */
export function checkInfoById(data?: object): Promise<any> {
    return get('/checks', data)
}

/**
 * 创建群组
 * @param data { name, creatorId, memberIds = [] }
 * @returns Promise<any> 
 * */
export function creatGroup(data?: object): Promise<any> {
    return post('/groups', data)
}

/**
 * 获取创建者的所有群组
 * @param data {creatorId}
 * @returns 
 */
export function getGroupList(data?: any): Promise<any> {
    return get('/groups/creator/' + data.creatorId)
}

/**
 * 根据名称搜索群组
 * @param data { name }
 * @returns 
 */
export function searchGroupByName(data?: object): Promise<any> {
    return get('/groups/search', data)
}

/**
 * 加入群组
 * @param data { groupId, userId }
 * @returns Promise<any>
 * */
export function joinGroup(data?: object): Promise<any> {
    return post('/groups/join', data)
}

/**
 * 用户打卡排名
 * @param data 
 * @returns Promise<any>
 * */
export function userRanking(): Promise<any> {
    return get('/users/ranking')
}

/**
 * 群组打卡排名
 * @param data
 * @returns Promise<any>
 * */
export function groupRanking(): Promise<any> {
    return get('/groups/ranking')
}

// // 文件上传示例
// upload<{ url: string }>('/upload', 'path/to/file', { description: 'test' })
//   .then(res => console.log(res.url))
//   .catch(err => console.error(err));