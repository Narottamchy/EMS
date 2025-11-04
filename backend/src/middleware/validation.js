const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    next();
  };
};

// Validation schemas
const schemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('admin', 'manager', 'viewer')
  }),

  createCampaign: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(1000),
    type: Joi.string().valid('immediate', 'scheduled', 'recurring'),
    templateName: Joi.string().min(1).max(64).required(),
    configuration: Joi.object({
      domains: Joi.array().items(Joi.string()).min(1).required(),
      baseDailyTotal: Joi.number().min(1).required(),
      maxEmailPercentage: Joi.number().min(1).max(100).required(),
      randomizationIntensity: Joi.number().min(0).max(1).required(),
      quotaDays: Joi.number().min(1),
      targetSum: Joi.number().min(1)
    }).required(),
    schedule: Joi.object({
      startDate: Joi.date(),
      endDate: Joi.date(),
      timezone: Joi.string(),
      recurringPattern: Joi.string().valid('daily', 'weekly', 'monthly')
    })
  }),

  createTemplate: Joi.object({
    name: Joi.string().min(1).max(64).required(),
    subject: Joi.string().min(1).max(500).required(),
    htmlBody: Joi.string().required(),
    textBody: Joi.string()
  })
};

module.exports = { validate, schemas };
