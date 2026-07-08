import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';

export class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async findById(id: string, userId: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(error.message, 500);
    }
    return data;
  }

  async findByUserId(userId: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new AppError(error.message, 500);
    }
    return data;
  }

  async create(payload: any, userId: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert({ ...payload, user_id: userId })
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, 500);
    }
    return data;
  }

  async update(id: string, payload: any, userId: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, 500);
    }
    return data;
  }

  async delete(id: string, userId: string) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(error.message, 500);
    }
  }
}
