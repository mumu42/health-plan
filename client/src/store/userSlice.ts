import { createSlice } from '@reduxjs/toolkit'

interface UserState {
  id: string
  name: string
  token: string | null
}

const initialState: UserState = {
  id: '',
  name: '',
  token: null
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.id = action.payload.id
      state.name = action.payload.name
      state.token = action.payload.token
    },
    clearUser: (state) => {
      state.id = ''
      state.name = ''
      state.token = null
    }
  }
})

export const { setUser, clearUser } = userSlice.actions
export default userSlice.reducer