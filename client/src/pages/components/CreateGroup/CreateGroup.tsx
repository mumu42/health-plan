import React, { useState, useEffect } from 'react';
import { View, Image, Text } from '@tarojs/components';
import { AtAccordion, AtList, AtListItem, AtForm, AtInput, AtButton } from 'taro-ui';
import { AtFloatLayout, AtAvatar } from 'taro-ui';
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { creatGroup, getGroupList } from '@/api/index'
type CreateGroupProps = {
  onAuthRequired: () => void;
};

const CreateGroup: React.FC<CreateGroupProps> = ({ onAuthRequired }) => {
  const [activePanel, setActivePanel] = useState<string>('');
  const [formData, setFormData] = useState({ groupName: '', description: '' });
  const [error, setError] = useState('');
  const user = useSelector((state: RootState) => state.user)

  const handleCreate = () => {
    // 添加登录验证
    if (!localStorage.getItem('userToken')) {
      onAuthRequired();  // 触发登录弹框
      return;
    }

    // 原有组名校验
    if (!formData.groupName.trim()) {
      setError('组名不能为空');
      return;
    }

    creatGroup({ name: formData.groupName, creatorId: user.id, memberIds: [] }).then(res => {
      if (res.code === 200) {
        console.log('创建成功:', res.data);
        setActivePanel('');  // 关闭面板
      } else {
        setError('创建失败');
      }
    })
  };

  // 新增状态管理
  const [isMemberVisible, setIsMemberVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState({
    name: '',
    members: [
      { id: 1, name: '用户A', avatar: 'https://example.com/avatar1.jpg' },
      { id: 2, name: '用户B', avatar: 'https://example.com/avatar2.jpg' }
    ]
  });

  useEffect(() => {
    user.id && getGroupList({creatorId: user.id}).then(res => {
      if (res.code === 200) {
        console.log('获取组列表成功:', res.data);
      } else {
        console.error('获取组列表失败:', res.message);
      }
    })
  }, []);

  // 处理组成员删除
  const handleDeleteMember = (memberId: number) => {
    console.log('删除成员:', memberId);
    // 实际开发中这里调用API
  };

  return (
    <View className="create-group-container">
      <AtAccordion
        title="创建新组"
        open={activePanel === 'create'}
        onClick={() => setActivePanel(activePanel === 'create' ? '' : 'create')}
      >
        <AtForm>
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
          if (!localStorage.getItem('userToken')) {
            onAuthRequired();  // 触发登录弹框
            return;
          }
          setActivePanel(activePanel === 'manage' ? '' : 'manage');
        }}
      >
        <View style={{padding: '20px'}}>
          <AtListItem 
            title="我的学习小组" 
            extraText="成员：5人"
            onClick={() => {
              setSelectedGroup({
                ...selectedGroup,
                name: '我的学习小组'
              });
              setIsMemberVisible(true);
            }}
          />
          <AtListItem title="健身打卡组" extraText="成员：12人" />
        </View>
      </AtAccordion>

      <AtAccordion
        title="进组"
        open={activePanel === 'join'}
        onClick={() => setActivePanel(activePanel === 'join' ? '' : 'join')}
      >
        <View style={{ padding: '20px' }}>
          <View>
            {[
              { id: 1, name: '学习打卡组' },
              { id: 2, name: '健身互助组' },
              { id: 3, name: '早起挑战组' }
            ].map(group => (
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
                    if (!localStorage.getItem('userToken')) {
                      onAuthRequired();  // 触发登录弹框
                      return;
                    }
                    console.log('加入组:', group.name);
                    // 这里可以添加实际的加入逻辑
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
        <View style={{ padding: '10px', maxHeight: '60vh', overflow: 'auto' }}>
          {selectedGroup.members.map(member => (
            <View 
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                borderBottom: '1px solid #eee'
              }}
            >
              <Image
                src={member.avatar}
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              />
              <Text style={{ flex: 1, marginLeft: '10px' }}>{member.name}</Text>
              <AtButton 
                type='secondary' 
                size='small'
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMember(member.id);
                }}
              >
                移除
              </AtButton>
            </View>
          ))}
        </View>
      </AtFloatLayout>
    </View>
  );
};

export default CreateGroup;