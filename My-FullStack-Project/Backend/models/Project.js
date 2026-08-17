const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    html: { type: String },
    css: { type: String },
    js: { type: String },
    author: { type: String, required: true },

    // ===== الحقول الجديدة لسلة المحذوفات =====
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // الحقول الموجودة مسبقاً
    views: { type: Number, default: 0 },
    likes: [{ type: String }],
    comments: [{
        author: String,
        text: String,
        createdAt: { type: Date, default: Date.now },
        edited: { type: Boolean, default: false },
        // ===== الردود داخل كل تعليق =====
        replies: [{
            author: String,
            text: String,
            createdAt: { type: Date, default: Date.now },
            edited: { type: Boolean, default: false }
        }]
    }],
    ratings: [{
        user: String,
        value: Number
    }]
}, {
    timestamps: true // يضيف createdAt و updatedAt تلقائياً
});

module.exports = mongoose.model('Project', ProjectSchema);
