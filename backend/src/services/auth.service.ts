import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';

export class AuthService {
  static async signUp(email: string, password: string, firstName?: string, lastName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      throw new AppError(error.message, error.status || 400);
    }

    return data;
  }

  static async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AppError(error.message, error.status || 401);
    }

    return data;
  }

  static async logout(token: string) {
    const { error } = await supabase.auth.admin.signOut(token); // Or regular signOut if context available
    if (error) {
      throw new AppError(error.message, error.status || 400);
    }
  }

  static async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });

    if (error) {
      throw new AppError(error.message, error.status || 400);
    }
  }

  static async resetPassword(password: string) {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      throw new AppError(error.message, error.status || 400);
    }
  }
}
