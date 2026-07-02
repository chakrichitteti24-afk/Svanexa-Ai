import { Response, Router } from 'express';

const router = Router();

const handlePeriodPrediction = async (req: any, res: Response) => {
  return res.json({
    message: "Period predictions are calculated locally on the client side."
  });
};

router.get('/', handlePeriodPrediction);
router.post('/', handlePeriodPrediction);

export default router;
