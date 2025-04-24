import { configureStore } from '@reduxjs/toolkit'
import userReducer from './userSlice'

const store = configureStore({
  reducer: {
    user: userReducer
    // 可以继续添加其他reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store