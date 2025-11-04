import { create } from 'zustand';
import { authAPI } from '../lib/api';
import toast from 'react-hot-toast';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authAPI.login(credentials);
      const { token, refreshToken, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      toast.success('Login successful!');
      return true;
    } catch (error) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Silent error handling
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });

      toast.success('Logged out successfully');
    }
  },

  updateUser: (userData) => {
    const updatedUser = { ...useAuthStore.getState().user, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      const response = await authAPI.getCurrentUser();
      const user = response.data.user;
      
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      set({ isAuthenticated: false, user: null });
      return false;
    }
  },
}));

export default useAuthStore;
