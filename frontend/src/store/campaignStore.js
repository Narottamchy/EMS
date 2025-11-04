import { create } from 'zustand';
import { campaignAPI } from '../lib/api';
import toast from 'react-hot-toast';

const useCampaignStore = create((set, get) => ({
  campaigns: [],
  currentCampaign: null,
  dashboard: null,
  isLoading: false,
  error: null,

  fetchCampaigns: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await campaignAPI.getAll(params);
      set({
        campaigns: response.data.campaigns,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to fetch campaigns',
        isLoading: false,
      });
      toast.error('Failed to fetch campaigns');
    }
  },

  fetchCampaignById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await campaignAPI.getById(id);
      const campaign = response.data.campaign || response.data.data?.campaign;
      set({
        currentCampaign: campaign,
        isLoading: false,
      });
      return campaign;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to fetch campaign',
        isLoading: false,
      });
      toast.error('Failed to fetch campaign');
      throw error;
    }
  },

  createCampaign: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await campaignAPI.create(data);
      set((state) => ({
        campaigns: [response.data.campaign, ...state.campaigns],
        isLoading: false,
      }));
      toast.success('Campaign created successfully!');
      return response.data.campaign;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to create campaign',
        isLoading: false,
      });
      toast.error(error.response?.data?.message || 'Failed to create campaign');
      throw error;
    }
  },

  updateCampaign: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await campaignAPI.update(id, data);
      set((state) => ({
        campaigns: state.campaigns.map((c) =>
          c._id === id ? response.data.campaign : c
        ),
        currentCampaign: response.data.campaign,
        isLoading: false,
      }));
      toast.success('Campaign updated successfully!');
      return response.data.campaign;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to update campaign',
        isLoading: false,
      });
      toast.error('Failed to update campaign');
      throw error;
    }
  },

  deleteCampaign: async (id) => {
    try {
      await campaignAPI.delete(id);
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c._id !== id),
      }));
      toast.success('Campaign deleted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete campaign');
      throw error;
    }
  },

  startCampaign: async (id) => {
    try {
      const response = await campaignAPI.start(id);
      set((state) => ({
        campaigns: state.campaigns.map((c) =>
          c._id === id ? { ...c, status: 'running' } : c
        ),
        currentCampaign: response.data.campaign,
      }));
      toast.success('Campaign started successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start campaign');
      throw error;
    }
  },

  pauseCampaign: async (id) => {
    try {
      const response = await campaignAPI.pause(id);
      set((state) => ({
        campaigns: state.campaigns.map((c) =>
          c._id === id ? { ...c, status: 'paused' } : c
        ),
        currentCampaign: response.data.campaign,
      }));
      toast.success('Campaign paused successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to pause campaign');
      throw error;
    }
  },

  resumeCampaign: async (id) => {
    try {
      const response = await campaignAPI.resume(id);
      set((state) => ({
        campaigns: state.campaigns.map((c) =>
          c._id === id ? { ...c, status: 'running' } : c
        ),
        currentCampaign: response.data.campaign,
      }));
      toast.success('Campaign resumed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resume campaign');
      throw error;
    }
  },

  fetchDashboard: async () => {
    try {
      const response = await campaignAPI.getDashboard();
      set({ dashboard: response.data });
    } catch (error) {
      // Silent error handling
    }
  },
}));

export default useCampaignStore;
