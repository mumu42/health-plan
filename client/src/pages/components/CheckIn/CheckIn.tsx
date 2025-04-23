import React, { useState, useEffect } from 'react';
import { View, Button, Text } from '@tarojs/components';
import './CheckIn.scss';

type CheckInProps = {
  onCheckInRequest?: () => void;  // 新增props用于通知父组件
};

const CheckIn: React.FC<CheckInProps> = ({ onCheckInRequest }) => {
  // 修改状态为打卡日期
  const [checkInDate, setCheckInDate] = useState<string>('');
  // 新增当天日期状态
  const [today] = useState(new Date().toLocaleDateString());
  
  useEffect(() => {
    // 修改存储字段为打卡日期
    const storedDate = localStorage.getItem('checkInDate');
    if (storedDate === today) {
      setCheckInDate(localStorage.getItem('checkInTime') || '');
    }
  }, []);

  const handleCheckIn = () => {
    if (!localStorage.getItem('userToken')) {
      onCheckInRequest?.();  // 通知父组件需要登录
      return;
    }

    const now = new Date();
    const timeString = now.toLocaleString();
    // 同时存储日期和时间
    localStorage.setItem('checkInDate', today);
    localStorage.setItem('checkInTime', timeString);
    setCheckInDate(timeString);
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
    </View>
  );
};

export default CheckIn;