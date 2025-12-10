# Group Features - Frontend Integration Guide

## Overview
This guide covers all the enhanced group features for the Group Details page implementation.

---

## New/Enhanced Endpoints

### 1. Get Group Details (Enhanced)
`GET /api/groups/:groupId`

**Response:**
```json
{
  "group": {
    "_id": "groupId123",
    "name": "Trip to Bali",
    "description": "Vacation expenses",
    "category": "trip",
    "members": [
      {
        "userId": {
          "_id": "userId1",
          "username": "john",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "role": "owner",
        "joinedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "memberInvitesAllowed": false,
    "createdBy": "userId1",
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "stats": {
    "totalExpenses": 1500.00,
    "expenseCount": 15,
    "totalSettlements": 500.00,
    "settlementCount": 3
  },
  "userBalance": {
    "youOwe": 250.50,
    "youreOwed": 100.00,
    "netBalance": -150.50,
    "balanceDetails": [
      {
        "type": "owes",
        "user": {
          "_id": "userId2",
          "username": "jane",
          "name": "Jane Doe"
        },
        "amount": 250.50
      }
    ]
  }
}
```

---

### 2. Create Group (Enhanced with Category)
`POST /api/groups`

**Request:**
```json
{
  "name": "Trip to Bali",
  "description": "Vacation expenses",
  "category": "trip",
  "memberInvitesAllowed": false
}
```

**Categories:** `"trip"`, `"home"`, `"couple"`, `"other"`

---

### 3. Search Friends by Username
`GET /api/friends/search?username=john`

**Response:**
```json
{
  "count": 2,
  "friends": [
    {
      "_id": "userId1",
      "username": "john_doe",
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "_id": "userId2",
      "username": "johnny",
      "name": "Johnny Smith",
      "email": "johnny@example.com"
    }
  ]
}
```

**Usage:** For searching and adding friends to groups

---

### 4. Add Member from Friend List  
`POST /api/groups/:groupId/members`

**Request:**
```json
{
  "friendId": "userId123",
  "role": "member"
}
```

**Roles:** `"owner"`, `"admin"`, `"member"` (default: "member")

**Permissions:**
- Owner and Admin can always add members
- Regular members can only add if `memberInvitesAllowed` is `true`

---

### 5. Generate Email Invite (with Gmail Integration)
`POST /api/groups/:groupId/invite`

**Request:**
```json
{
  "email": "newuser@example.com"
}
```

**Response:**
```json
{
  "message": "Invite created successfully and email sent",
  "invite": {
    "_id": "inviteId123",
    "token": "abc123...",
    "inviteLink": "http://localhost:5173/invite/abc123...",
    "expiresAt": "2025-01-15T00:00:00.000Z"
  }
}
```

**Note:** Email is automatically sent via Gmail API. User receives invite link via email.

---

### 6. Get Group Expenses
`GET /api/expenses?groupId=groupId123&limit=20&skip=0`

Already exists, no changes.

---

### 7. Get Group Settlements
`GET /api/settlements/group/:groupId?limit=20&skip=0`

**Response:**
```json
{
  "count": 3,
  "total": 3,
  "settlements": [
    {
      "_id": "settlementId1",
      "paidBy": {
        "_id": "userId1",
        "username": "john",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "paidTo": {
        "_id": "userId2",
        "username": "jane",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "amount": 150.00,
      "groupId": "groupId123",
      "note": "Cash payment",
      "settledAt": "2025-01-10T00:00:00.000Z"
    }
  ]
}
```

---

## Enhanced Expense Features

### 8. Create Expense with Smart Splits
`POST /api/expenses`

#### Equal Split (Default)
```json
{
  "description": "Dinner",
  "amount": 100,
  "splitType": "equal",
  "participants": [
    { "userId": "user1" },
    { "userId": "user2" },
    { "userId": "user3" }
  ],
  "groupId": "groupId123",
  "category": "food"
}
```
**Result:** Each pays $33.33

#### Smart Custom Split (NEW!)
```json
{
  "description": "Shopping",
  "amount": 100,
  "splitType": "exact",
  "participants": [
    { "userId": "user1", "share": 50 },  // Assigned
    { "userId": "user2" },                // Auto-calculated
    { "userId": "user3" }                 // Auto-calculated
  ]
}
```
**Result:** 
- user1: $50 (as assigned)
- user2: $25 (auto: remaining $50 ÷ 2)
- user3: $25 (auto: remaining $50 ÷ 2)

**Use Cases:**
- Payer assigns specific amounts to some people
- Remaining amount divided equally among others
- No need to calculate manually!

#### Smart Percentage Split (NEW!)
```json
{
  "description": "Rent",
  "amount": 1000,
  "splitType": "percentage",
  "participants": [
    { "userId": "user1", "share": 50 },  // 50%
    { "userId": "user2" },                // Auto-calculated
    { "userId": "user3" }                 // Auto-calculated
  ]
}
```
**Result:**
- user1: $500 (50% as assigned)
- user2: $250 (auto: remaining 50% ÷ 2 = 25%)
- user3: $250 (auto: remaining 50% ÷ 2 = 25%)

---

### 9. Change Payer on Expense (NEW!)
`PUT /api/expenses/:expenseId/change-payer`

**Request:**
```json
{
  "newPayerId": "userId123"
}
```

**Requirements:**
- New payer must be a participant in the expense
- Only creator or current payer can change the payer
- Automatically updates all balances

**Response:**
```json
{
  "message": "Payer changed successfully",
  "expense": { /* updated expense */ }
}
```

---

### 10. Edit Expense
`PUT /api/expenses/:expenseId`

**Now supports smart splits!** Same logic as create expense.

---

### 11. Delete Expense
`DELETE /api/expenses/:expenseId`

Already exists, no changes. Automatically reverts balances.

---

## UI Implementation Guide

### Group Details Page Structure

```
┌────────────────────────────────────────────────────────┐
│  GROUP HEADER                                          │
│  Name: Trip to Bali                                    │
│  Category: Trip                                        │
│  Description: Vacation expenses                        │
│  Created by: John Doe                                  │
│  Members: 5                                           │
│  Total Expenses: $1,500.00                            │
└────────────────────────────────────────────────────────┘

┌─────────────────┬──────────────────────┬──────────────┐
│   SIDEBAR       │    EXPENSES          │              │
│                 │                       │              │
│ 👥 Members (5)  │  Dinner - $100       │              │
│ ├─ John (owner) │  Shopping - $50      │              │
│ ├─ Jane (admin) │  Rent - $1000        │              │
│ ├─ Bob          │  ...                 │              │
│ └─ Add Member   │                       │              │
│                 │  + Add Expense       │              │
│ 💰 Your Balance │                       │              │
│ You owe: $250   │                       │              │
│ You're owed:$100│                       │              │
│ Net: -$150      │                       │              │
│                 │                       │              │
│ 💸 Settlement   │                       │              │
│ [Settle Up]     │                       │              │
└─────────────────┴──────────────────────┴──────────────┘
```

---

## Component Examples

### 1. Fetch Group Details
```typescript
async function loadGroupDetails(groupId: string) {
  const response = await fetch(`http://localhost:8002/api/groups/${groupId}`, {
    credentials: 'include'
  });
  const data = await response.json();
  
  return {
    group: data.group,
    stats: data.stats,
    userBalance: data.userBalance
  };
}
```

### 2. Search Friends Component
```typescript
async function searchFriends(searchTerm: string) {
  const response = await fetch(
    `http://localhost:8002/api/friends/search?username=${encodeURIComponent(searchTerm)}`,
    { credentials: 'include' }
  );
  return response.json();
}

// Usage
const [searchTerm, setSearchTerm] = useState('');
const [results, setResults] = useState([]);

const handleSearch = async () => {
  const data = await searchFriends(searchTerm);
  setResults(data.friends);
};
```

### 3. Add Member from Search
```typescript
async function addMemberToGroup(groupId: string, friendId: string) {
  const response = await fetch(
    `http://localhost:8002/api/groups/${groupId}/members`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId, role: 'member' })
    }
  );
  return response.json();
}
```

### 4. Generate and Send Email Invite
```typescript
async function sendInviteEmail(groupId: string, email: string) {
  const response = await fetch(
    `http://localhost:8002/api/groups/${groupId}/invite`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }
  );
  return response.json();
}

// Usage
const handleInvite = async (email: string) => {
  const result = await sendInviteEmail(groupId, email);
  toast.success(`Invite sent to ${email}!`);
  // Email automatically sent via Gmail
};
```

### 5. Create Expense with Smart Custom Split
```typescript
async function createExpenseSmartCustom(expenseData: {
  description: string;
  amount: number;
  participants: Array<{ userId: string; share?: number }>;
  groupId: string;
}) {
  const response = await fetch('http://localhost:8002/api/expenses', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...expenseData,
      splitType: 'exact'  // System auto-calculates for unassigned
    })
  });
  return response.json();
}

// Example: Payer assigns $50 to one person, rest auto-calculated
const expense = await createExpenseSmartCustom({
  description: 'Groceries',
  amount: 100,
  participants: [
    { userId: currentUserId },              // Payer
    { userId: 'friend1', share: 50 },       // Assigned $50
    { userId: 'friend2' },                  // Auto: $25
    { userId: 'friend3' }                   // Auto: $25
  ],
  groupId: 'groupId123'
});
```

### 6. Create Expense with Smart Percentage Split
```typescript
async function createExpenseSmartPercentage(expenseData: {
  description: string;
  amount: number;
  participants: Array<{ userId: string; share?: number }>;
  groupId: string;
}) {
  const response = await fetch('http://localhost:8002/api/expenses', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...expenseData,
      splitType: 'percentage'  // System auto-calculates for unassigned
    })
  });
  return response.json();
}

// Example: Assign 60% to one person, rest auto-divided
const expense = await createExpenseSmartPercentage({
  description: 'Rent',
  amount: 1000,
  participants: [
    { userId: currentUserId },        // Payer
    { userId: 'friend1', share: 60 }, // 60% = $600
    { userId: 'friend2' },            // Auto: 20% = $200
    { userId: 'friend3' }             // Auto: 20% = $200
  ],
  groupId: 'groupId123'
});
```

### 7. Change Payer
```typescript
async function changePayer(expenseId: string, newPayerId: string) {
  const response = await fetch(
    `http://localhost:8002/api/expenses/${expenseId}/change-payer`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPayerId })
    }
  );
  return response.json();
}
```

---

## TypeScript Interfaces

```typescript
interface GroupDetails {
  group: {
    _id: string;
    name: string;
    description: string;
    category: 'trip' | 'home' | 'couple' | 'other';
    members: Array<{
      userId: User;
      role: 'owner' | 'admin' | 'member';
      joinedAt: string;
    }>;
    memberInvitesAllowed: boolean;
    createdBy: string;
    createdAt: string;
  };
  stats: {
    totalExpenses: number;
    expenseCount: number;
    totalSettlements: number;
    settlementCount: number;
  };
  userBalance: {
    youOwe: number;
    youreOwed: number;
    netBalance: number;
    balanceDetails: Array<{
      type: 'owes' | 'owed';
      user: User;
      amount: number;
    }>;
  };
}

interface ExpenseParticipant {
  userId: string;
  share?: number;  // Optional for smart splits
}

interface CreateExpenseRequest {
  description: string;
  amount: number;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: ExpenseParticipant[];
  groupId?: string;
  category?: string;
  notes?: string;
}
```

---

## Permission Matrix

| Action | Owner | Admin | Member (invites allowed) | Member (invites not allowed) |
|--------|-------|-------|-------------------------|------------------------------|
| View group details | ✅ | ✅ | ✅ | ✅ |
| Add member from friends | ✅ | ✅ | ✅ | ❌ |
| Generate email invite | ✅ | ✅ | ✅ | ❌ |
| Remove member | ✅ | ✅ | ❌ | ❌ |
| Update group settings | ✅ | ✅ | ❌ | ❌ |
| Delete group | ✅ | ❌ | ❌ | ❌ |
| Create expense | ✅ | ✅ | ✅ | ✅ |
| Edit own expense | ✅ | ✅ | ✅ | ✅ |
| Delete own expense | ✅ | ✅ | ✅ | ✅ |
| Change payer (if creator) | ✅ | ✅ | ✅ | ✅ |

---

## Environment Setup

Add to your `.env` file:

```env
MONGO_URL=mongodb://localhost:27017/splitwise
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

# Gmail API (for email invites)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
```

---

## Testing Checklist

### Group Details
- [ ] Load group details with stats and balance
- [ ] Display total expenses correctly
- [ ] Show user's balance in group
- [ ] Display member count correctly

### Member Management
- [ ] Search friends by username
- [ ] Add member from friend list
- [ ] Remove member (permission check)
- [ ] Generate email invite
- [ ] Email sent via Gmail
- [ ] Accept invite via link

### Expense Management
- [ ] Create expense with equal split
- [ ] Create expense with smart custom split
- [ ] Create expense with smart percentage split
- [ ] Edit expense
- [ ] Delete expense
- [ ] Change payer on expense
- [ ] Verify balances update correctly

### Settlements
- [ ] View group settlements
- [ ] Create settlement
- [ ] Verify balance updates after settlement

---

## Quick Reference

| Feature | Endpoint | Method |
|---------|----------|--------|
| Get group details | `/api/groups/:groupId` | GET |
| Search friends | `/api/friends/search?username=xxx` | GET |
| Add member | `/api/groups/:groupId/members` | POST |
| Email invite | `/api/groups/:groupId/invite` | POST |
| Remove member | `/api/groups/:groupId/members/:memberId` | DELETE |
| Create expense | `/api/expenses` | POST |
| Change payer | `/api/expenses/:expenseId/change-payer` | PUT |
| Edit expense | `/api/expenses/:expenseId` | PUT |
| Delete expense | `/api/expenses/:expenseId` | DELETE |
| Get group expenses | `/api/expenses?groupId=xxx` | GET |
| Get group settlements | `/api/settlements/group/:groupId` | GET |

---

## Notes

- All endpoints require authentication (`credentials: 'include'`)
- Smart splits automatically calculate remaining amounts/percentages
- Gmail integration is non-blocking (invite still created if email fails)
- Balances update automatically for all expense/settlement operations
- Permission checks are enforced on the backend
