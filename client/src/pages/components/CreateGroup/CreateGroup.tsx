import React, { useState, useEffect } from 'react';
import { View, Image, Text } from '@tarojs/components';
import { AtAccordion, AtListItem, AtForm, AtInput, AtButton, AtToast, AtFloatLayout, AtMessage } from 'taro-ui';
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { creatGroup, getOwnerGroupList, delGroupItem, deleteGroup, getNotJoinGroupList, groupAll, joinGroup } from '@/api/index'
import "taro-ui/dist/style/components/float-layout.scss";
import './CreateGroup.scss';
import Taro from '@tarojs/taro'; // 确保导入 Taro
type CreateGroupProps = {
  onAuthRequired: () => void;
};

const CreateGroup: React.FC<CreateGroupProps> = ({ onAuthRequired }) => {
  const [activePanel, setActivePanel] = useState<string>('');
  const [formData, setFormData] = useState({ groupName: '', description: '' });
  const [error, setError] = useState('');
  const user = useSelector((state: RootState) => state.user)
  const [showToast, setShowToast] = useState(false);
  const [toastText, setToastText] = useState('');

  const handleCreate = () => {
    // 添加登录验证
    if (!user.id) {
      onAuthRequired();  // 触发登录弹框
      return;
    }

    // 原有组名校验
    if (!formData.groupName.trim()) {
      setError('组名不能为空');
      return;
    }

    creatGroup({ name: formData.groupName, creatorId: user.id, memberIds: [ user.id ] }).then(res => {
      if (res.code === 200) {
        console.log('创建成功:', res.data);
        setActivePanel('');  // 关闭面板
        groupList()
      } else {
        setError('创建失败');
      }
    }).catch(err => {
      Taro.atMessage({
        'message': err.message || '失败！',
        'type': 'error',
      })
    })
  };

  // 新增状态管理
  const [isMemberVisible, setIsMemberVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState({
    name: '',
    id: '',
    ownerId: '',
    members: []
  });
  const [memberList, setMemberList] = useState([])
  const [notJoinGroupAll, setNotJoinGroupAll]: any = useState([])


  useEffect(() => {
    console.warn('user=', user)
    if (user.id) {
      groupList()
      getNotJoinGroupAll()
    } else {
      getNotJoinGroupAll()
    }
  }, [user]);

  async function getNotJoinGroupAll() {
    let res: any = {}
    if (user.id) {
      res = await getNotJoinGroupList({userId: user.id})
    } else {
      res = await groupAll()
    }
      if (res.code === 200) {
        console.log('获取成功:', res.data);
        setActivePanel('');  // 关闭面板
        setNotJoinGroupAll(res.data)
      } else {
        setError('创建失败');
      }
  }

  function groupList() {
    getOwnerGroupList({creatorId: user.id}).then(res => {
      if (res.code === 200) {
        const { data } = res
        data && setMemberList((data || []).map((item: any) => {
          return {
            ...item,
            ownerId: item.creator
          }
        }))
        console.log('获取组列表成功:', res.data);
      } else {
        setToastText(`获取组列表失败: ${res.message}`);
        setShowToast(true);
        console.error('获取组列表失败:', res.message);
      }
    }).catch(err => {
      setToastText(`获取组列表发生错误: ${err.message}`);
      setShowToast(true);
      console.error('获取组列表发生错误:', err);
    });
  }

  // 处理组成员删除
  function handleDeleteMember(member: any, type: string) {
    console.log('删除成员:', member);
    if (selectedGroup.members.length === 1) {
      Taro.showModal({
        title: `确认${type === 'out' ? '退出' : '删除'}`,
        content: `该组只有一个成员，一旦${type === 'out' ? '退出' : '删除'}则该群直接删除，请问是否确认操作？`,
        success: (res) => {
          if (res.confirm) {
            // 这里可以添加实际删除组的逻辑
            console.log('用户确认删除组');
            deleteGroup({ userId: user.id, groupId: selectedGroup.id }).then(res => {
              if (res.code === 200) {
                // 删除成功，关闭详情弹出框并重新刷新获取列表数据
                setIsMemberVisible(false);
                groupList();
              } else {
                // 删除失败，弹出信息框
                setToastText(`删除失败: ${res.message}`);
                setShowToast(true);
              }
            }).catch(err => {
              // 请求出错，弹出信息框
              setToastText(`删除发生错误: ${err.message}`);
              setShowToast(true);
            });
          }
        }
      });
      return;
    }
    delGroupItem({ id: selectedGroup.id, userId: user.id, memberId: member._id }).then(res => {
      if (res.code === 200) {
        // 删除成员成功，关闭详情弹出框并重新刷新获取列表数据
        setIsMemberVisible(false);
        groupList();
      } else {
        // 删除成员失败，弹出信息框
        setToastText(`删除成员失败: ${res.message}`);
        setShowToast(true);
      }
    }).catch(err => {
      // 请求出错，弹出信息框
      setToastText(`删除成员发生错误: ${err.message}`);
      setShowToast(true);
    });
  };

  const getMemberDetail = (item: any) => {
      console.warn(item, 'itemitemitem')
    setSelectedGroup({
        id: item.id,
        members: item.members,
        name: item.name,
        ownerId: item.ownerId
      });
      setIsMemberVisible(true);
  }

  // 假设原来的样式对象是这样
  const styles = {
    // 错误的写法
    // '-webkit-transform': 'translateX(100px)',
    // 正确的写法
    WebkitTransform: 'translateX(0px)'
  };

  function joinGroupItem(group: any) {
    console.log('group=', group)
    joinGroup({id: group.id, userId: user.id}).then(res => {
      if (res.code === 200) {
        // 删除成员成功，关闭详情弹出框并重新刷新获取列表数据
        groupList();
        getNotJoinGroupAll()
        setToastText('加入成功');
      } else {
        setToastText(`${res.message}`);
      }
    })
  }

  return (
    <View className="create-group-container" style={styles}>
      <AtMessage />
      <AtAccordion
        title="创建新组"
        open={activePanel === 'create'}
        onClick={() => setActivePanel(activePanel === 'create' ? '' : 'create')}
      >
        <AtForm style={{ padding: '20px' }}>
          <AtInput
            name="groupName"
            required
            title="组名称"
            value={formData.groupName}
            onChange={(value) => setFormData({...formData, groupName: value.toString()})}
          />
          {error && <View style={{color: 'red', padding: '10px'}}>{error}</View>}
          <AtButton type="primary" onClick={handleCreate}>立即创建</AtButton>
        </AtForm>
      </AtAccordion>

      <AtAccordion
        title="我的组"
        open={activePanel === 'manage'}
        onClick={() => {
          // 添加登录验证
          if (!user.id) {
            onAuthRequired();  // 触发登录弹框
            return;
          }
          setActivePanel(activePanel === 'manage' ? '' : 'manage');
        }}
      >
        <View style={{ padding: '20px' }}>
          {memberList.length === 0 ? (
           <View className='at-article__p'>
           您还未进入任何群组！
        </View>
          ) : (
            memberList.map((item: any) => {
              return (
                <AtListItem
                  key={item.id}
                  title={item.name}
                  extraText={ `成员：${item.members.length}人`}
                  onClick={() => getMemberDetail(item)}
                />
              );
            })
          )}
        </View>
      </AtAccordion>

      <AtAccordion
        title="进组"
        open={activePanel === 'join'}
        onClick={() => setActivePanel(activePanel === 'join' ? '' : 'join')}
      >
        <View style={{ padding: '20px' }}>
          <View>
          {!notJoinGroupAll.length && <View className='at-article__p'>
         还未有人创建组群，快去邀请的小伙伴一起创建组群吧！
      </View>}
            {notJoinGroupAll.map(group => (
              <View 
                key={group.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderBottom: '1px solid #eee'
                }}
              >
                <Text>{group.name}</Text>
                <AtButton 
                  type='primary' 
                  size='small'
                  onClick={() => {
                    // 添加登录验证
                    if (!user.id) {
                      onAuthRequired();  // 触发登录弹框
                      return;
                    }
                    joinGroupItem(group)
                  }}
                >
                  加入
                </AtButton>
              </View>
            ))}
          </View>
        </View>
      </AtAccordion>
      {/* 成员管理浮层 */}
      <AtFloatLayout 
        isOpened={isMemberVisible} 
        title={`${selectedGroup.name} 成员管理`}
        onClose={() => setIsMemberVisible(false)}
      >
        {/* 显示对应组群的成员信息 */}
        <View style={{ padding: '10px', maxHeight: '60vh', overflow: 'auto' }}>
          
          {(selectedGroup.members || []).map((member: any) => (
            <View 
              key={member.createdAt}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #eee'
              }}
            >
              {member.avatar && <Image
                src={member.avatar}
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              />}
              <Text style={{ flex: 1, marginLeft: '10px' }}>{member.nickname}</Text>
              {selectedGroup.ownerId === user.id && user.id !== member._id && <AtButton
                type='secondary'
                size='small'
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMember(member, 'del');
                }}
              >
                移除
              </AtButton>}
              {member._id === user.id && <AtButton
                type='secondary'
                size='small'
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMember(member, 'out');
                }}
              >
                退出
              </AtButton>}
            </View>
          ))}
        </View>
      </AtFloatLayout>
      <AtToast
        isOpened={showToast}
        text={toastText}
        duration={3000}
        onClose={() => setShowToast(false)}
      />
    </View>
  );
};

export default CreateGroup;
