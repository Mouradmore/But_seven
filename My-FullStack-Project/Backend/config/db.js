const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // الاتصال برابط قاعدة البيانات الموجود في ملف .env أو الرابط المحلي الافتراضي
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/devCommunity');
    
    console.log(`✅ متصل بقاعدة البيانات بنجاح: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ فشل الاتصال بقاعدة البيانات: ${err.message}`);
    // إيقاف تشغيل السيرفر فوراً في حال فشل الاتصال بقاعدة البيانات
    process.exit(1);
  }
};

module.exports = connectDB;