const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    html: { type: String, default: '' },
    css: { type: String, default: '' },
    js: { type: String, default: '' },
    author: { type: String, required: true },
    views: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    likes: [{ type: String }], // أسماء المستخدمين الذين أعجبهم المشروع
    
    // نظام التعليقات مع الردود
    comments: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        author: { type: String, required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        replies: [{
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            author: { type: String, required: true },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }]
    }],
    
    // نظام التقييم بالنجوم
    ratings: [{
        user: { type: String, required: true },
        value: { type: Number, required: true, min: 1, max: 5 },
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Project', ProjectSchema);
