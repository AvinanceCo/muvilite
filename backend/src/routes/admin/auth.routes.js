/**
 * Admin authentication routes.
 *
 * Purpose: endpoint definitions for signing in and managing one's own account.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/admin/auth, middleware/{auth,validate}
 *
 * The legacy login had NO throttling — `MAX_TRY_LOGIN` existed in
 * admin/includes/define.php but belonged to the public API and was never
 * applied here. A strict limiter is mounted on the login route.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { postLogin, postLogout, getMe, patchPassword } from '../../controllers/admin/auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import { loginRules, changePasswordRules } from '../../validators/auth.validators.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Failed attempts are what we're rate limiting; a successful sign-in should
  // not consume anyone's budget.
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts, try again later', errors: [] },
});

router.post('/login', loginLimiter, validate(loginRules), postLogin);
router.post('/logout', authenticate, postLogout);
router.get('/me', authenticate, getMe);
router.patch('/password', authenticate, validate(changePasswordRules), patchPassword);

export default router;
