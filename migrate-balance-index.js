import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function migrateBalanceIndexes() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const balancesCollection = db.collection('balances');

        console.log('\n📋 Current indexes:');
        const indexes = await balancesCollection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        // Drop the old unique index that doesn't include groupId
        console.log('\n🗑️  Dropping old index: fromUserId_1_toUserId_1');
        try {
            await balancesCollection.dropIndex('fromUserId_1_toUserId_1');
            console.log('✅ Old index dropped successfully');
        } catch (error) {
            if (error.code === 27) {
                console.log('ℹ️  Index already dropped or doesn\'t exist');
            } else {
                throw error;
            }
        }

        // Create the new unique index with groupId
        console.log('\n🔨 Creating new index: fromUserId_1_toUserId_1_groupId_1');
        await balancesCollection.createIndex(
            { fromUserId: 1, toUserId: 1, groupId: 1 },
            { unique: true, name: 'fromUserId_1_toUserId_1_groupId_1' }
        );
        console.log('✅ New index created successfully');

        console.log('\n📋 Updated indexes:');
        const newIndexes = await balancesCollection.indexes();
        newIndexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

migrateBalanceIndexes();
