const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code:       { type: String, required: true },
  language:   { type: String, default: 'Auto' },
  fileName:   { type: String, default: null },
  linesCount: { type: Number, default: 0 },
  mode:       { type: String, enum: ['review','smells','suggest','doc','security','test','report','assistant'], required: true },
  result: {
    rawText:   { type: String },
    score:     { type: Number, min: 0, max: 10, default: null },
    fileChanges: [{
      path: { type: String },
      operation: { type: String, enum: ['create', 'update'], default: 'update' },
      severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: null },
      summary: { type: String, default: '' },
    }],
  },
  duration:   { type: Number, default: 0 },
  status:     { type: String, enum: ['pending','completed','failed'], default: 'completed' },
}, { timestamps: true });

AnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', AnalysisSchema);
