import React, { useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import { AtForm, AtInput, AtButton, AtDivider, AtIcon } from 'taro-ui';
import './LoginCmp.scss';
// 假设图片在当前目录下，引入图片
import loginImage from '@/assets/images/logo.gif'; 
import { Image, View } from '@tarojs/components';
import { login } from '@/api/index'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { setUser } from '@/store/userSlice'

// 定义登录表单的数据类型
type LoginForm = {
  nickname: string;
  password: string;
};

type LoginProps = {
  isOpen: boolean;
  onClose: () => void;
};

const LoginCmp: React.FC<LoginProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<LoginForm>({
    nickname: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  // 在组件内
  const user = useSelector((state: RootState) => state.user)
  const dispatch = useDispatch<AppDispatch>()

  // 处理输入框值的变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // 处理登录提交
  const handleLoginSubmit = () => {
    const { nickname, password } = formData;
    // 校验昵称和密码是否为空
    if (nickname === '' || password === '') {
      setErrorMessage('昵称和密码为必填项');
      return;
    }

    login({nickname, password}).then(res => {
      // 简单验证，实际应用中应替换为后端验证逻辑
      if (res.code === 200) {
        const { id, nickname } = res.data;
        // 更新用户信息
        dispatch(setUser({ name: nickname, token: 'token值', id}))
        window.localStorage.setItem('user-info', JSON.stringify({name: nickname, id}))
        setErrorMessage('');
        onClose();
      } else {
        setErrorMessage('昵称或密码错误');
      }
    }).catch(err => console.error(err))
    
  };

  return (
    <CSSTransition
      in={isOpen}
      timeout={300}
      classNames="login-modal"
      unmountOnExit
    >
      <View className="login-overlay" onClick={onClose}>
        <View className="login-container" onClick={(e) => e.stopPropagation()}>
          <AtIcon
            value="close"
            size="20"
            color="#666"
            className="close-button"
            onClick={onClose}
          />
          <Image 
            src={loginImage} 
            className="login-logo"
            mode="aspectFit"
          />
          <AtDivider content="·" fontColor='#2d8cf0' lineColor='#2d8cf0'/>
          <View className="login-form">
            <AtInput
              required
              name="nickname"
              title="昵称"
              placeholder="请输入用户名"
              value={formData.nickname}
              onChange={(value) => handleInputChange({ target: { name: 'nickname', value } } as React.ChangeEvent<HTMLInputElement>)}
            />
            <AtInput
              required
              name="password"
              title="密码" 
              placeholder="请输入密码"
              type="password"
              value={formData.password}
              onChange={(value) => handleInputChange({ target: { name: 'password', value } } as React.ChangeEvent<HTMLInputElement>)}
            />
          </View>
          {errorMessage && <View className="login-error">{errorMessage}</View>}
          <View className="login-button">
            <AtButton 
              type='primary' 
              onClick={handleLoginSubmit}
            >
              登录/注册
            </AtButton>
          </View>
        </View>
      </View>
    </CSSTransition>
  );
};

export default LoginCmp;
