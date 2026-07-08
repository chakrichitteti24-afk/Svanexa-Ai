import { BaseRepository } from './base.repository';
import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';

export class UserRepository extends BaseRepository {
  constructor() {
    super('profiles');
  }

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(error.message, 500);
    }
    return data;
  }

  async updateProfile(userId: string, payload: any) {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, 500);
    }
    return data;
  }
}
