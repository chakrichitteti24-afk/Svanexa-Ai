import { Response, Router } from 'express';

const router = Router();

const handleHealthSummary = async (req: any, res: Response) => {
  return res.json({
    message: "Health summary is calculated locally on the client side."
  });
};

router.get('/', handleHealthSummary);
router.post('/', handleHealthSummary);

export default router;
