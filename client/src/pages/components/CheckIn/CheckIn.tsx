import React, { useState, useEffect } from 'react';
import { View, Button, Text } from '@tarojs/components';
import './CheckIn.scss';
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { checkIn } from '@/api/index'
import Taro from '@tarojs/taro'
import { AtMessage } from 'taro-ui'

type CheckInProps = {
  onCheckInRequest?: () => void;  // 新增props用于通知父组件
};

const CheckIn: React.FC<CheckInProps> = ({ onCheckInRequest }) => {
  // 修改状态为打卡日期
  const [checkInDate, setCheckInDate] = useState<string>('');
  // 新增当天日期状态
  const [today] = useState(new Date().toLocaleDateString());
  const user = useSelector((state: RootState) => state.user)
  
  useEffect(() => {
    // 修改存储字段为打卡日期
    const storedDate = localStorage.getItem('checkInDate');
    if (storedDate === today) {
      setCheckInDate(localStorage.getItem('checkInTime') || '');
    }
  }, []);

  const handleCheckIn = () => {
    console.warn(user)
    if (!user.id) {
      onCheckInRequest?.();  // 通知父组件需要登录
      return;
    }

    checkIn({userId: user.id, groupId: '', status: 'completed', notes: ''}).then(res => {
      if (res.code === 200) {
        const now = new Date();
        const timeString = now.toLocaleString();
        // 同时存储日期和时间
        localStorage.setItem('checkInDate', today);
        localStorage.setItem('checkInTime', timeString);
        setCheckInDate(timeString);
      } else {
        Taro.atMessage({
          'message': res.message,
          'type': 'error',
        })
      }
    }).catch(err => {
      Taro.atMessage({
        'message': err.message || '失败！',
        'type': 'error',
      })
    })
  };

  return (
    <View className="check-in-container">
      {checkInDate ? (
        <View>
          <Text>今日已打卡</Text>
          <Text>打卡时间：{checkInDate}</Text>
        </View>
      ) : (
        <Button onClick={handleCheckIn}>立即打卡</Button>
      )}
      <AtMessage />
    </View>
  );
};

export default CheckIn;