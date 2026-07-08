import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { catchAsync } from '../utils/catchAsync';

export class AuthController {
  static signUp = catchAsync(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;
    const data = await AuthService.signUp(email, password, firstName, lastName);
    
    // Set cookie if needed, though Supabase client on frontend usually handles this
    if (data.session) {
      res.cookie('sb_access_token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: data.session.expires_in * 1000,
      });
    }

    res.status(201).json({
      status: 'success',
      data,
    });
  });

  static login = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password);

    if (data.session) {
      res.cookie('sb_access_token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: data.session.expires_in * 1000,
      });
    }

    res.status(200).json({
      status: 'success',
      data,
    });
  });

  static logout = catchAsync(async (req: Request, res: Response) => {
    let token = req.cookies?.sb_access_token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      // Best effort logout, normally handled on client side with supabase.auth.signOut()
      // Service role client cannot sign out a user's token directly easily without admin api
    }

    res.cookie('sb_access_token', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({ status: 'success' });
  });

  static forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;
    await AuthService.forgotPassword(email);
    res.status(200).json({ status: 'success', message: 'Password reset email sent' });
  });

  static resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { password } = req.body;
    await AuthService.resetPassword(password);
    res.status(200).json({ status: 'success', message: 'Password reset successful' });
  });

  static me = catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      data: { user: req.user },
    });
  });
}
