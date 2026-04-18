const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/next-salon?directConnection=true')
  .then(async () => {
    console.log('Connected to DB');
    const db = mongoose.connection.db;
    const invs = await db.collection('invoices').find({}).sort({createdAt: -1}).limit(3).toArray();
    
    // Print the raw discount values stored in DB
    invs.forEach((inv, i) => {
      console.log(`Invoice ${i+1}: _id: ${inv._id}, discount: ${inv.discount}, subtotal: ${inv.subtotal}, totalAmount: ${inv.totalAmount}, status: ${inv.status}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
