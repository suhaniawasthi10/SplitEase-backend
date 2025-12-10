# Frontend Integration Guide

## Quick Start

### Base URL
```
http://localhost:8002/api
```

### Authentication
- Uses **httpOnly cookies** for JWT tokens
- Include `credentials: 'include'` in all fetch requests
- No need to manually handle tokens

### CORS Configuration
Already configured for:
- `http://localhost:5173` (Vite default)
- `http://localhost:5174` (Vite alt)

---

## TypeScript Types/Interfaces

```typescript
// User
interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// Friend Request
interface Friend {
  _id: string;
  userId: User;
  friendId: User;
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

// Group
interface Group {
  _id: string;
  name: string;
  description: string;
  members: Array<{
    userId: User;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
  }>;
  memberInvitesAllowed: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Expense
interface Expense {
  _id: string;
  description: string;
  amount: number;
  paidBy: User;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: Array<{
    userId: User;
    share: number;
  }>;
  groupId?: string;
  category: string;
  notes: string;
  date: string;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

// Settlement
interface Settlement {
  _id: string;
  paidBy: User;
  paidTo: User;
  amount: number;
  groupId?: string;
  note: string;
  settledAt: string;
  createdAt: string;
  updatedAt: string;
}

// Balance Summary
interface BalanceSummary {
  youOwe: number;
  youreOwed: number;
  netBalance: number;
  owedCount: number;
  owedByCount: number;
}

// Activity
interface Activity {
  _id: string;
  activityType: string;
  userId: User;
  targetUserId?: User;
  groupId?: Group;
  expenseId?: Expense;
  settlementId?: Settlement;
  metadata: any;
  description: string;
  createdAt: string;
}

// API Response Types
interface ApiResponse<T> {
  message?: string;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  count: number;
  total: number;
  data: T[];
}
```

---

## API Helper Functions

### Base Fetch Wrapper
```typescript
const API_BASE = 'http://localhost:8002/api';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // IMPORTANT: Include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}
```

---

## Authentication APIs

### Signup
```typescript
interface SignupRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

async function signup(data: SignupRequest): Promise<User> {
  return apiRequest<User>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Usage
try {
  const user = await signup({
    name: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  });
  console.log('Signup successful', user);
} catch (error) {
  console.error('Signup failed', error.message);
}
```

### Login
```typescript
interface LoginRequest {
  username: string;
  password: string;
}

async function login(data: LoginRequest): Promise<User> {
  return apiRequest<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Usage
const user = await login({ username: 'johndoe', password: 'password123' });
```

### Logout
```typescript
async function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}
```

### Get Current User
```typescript
async function getCurrentUser(): Promise<User> {
  return apiRequest<User>('/user/current');
}

// Usage - Check if logged in
try {
  const user = await getCurrentUser();
  console.log('Logged in as', user.username);
} catch (error) {
  console.log('Not logged in');
}
```

---

## Friend APIs

### Send Friend Request
```typescript
async function sendFriendRequest(friendUsername: string) {
  return apiRequest('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ friendUsername }),
  });
}

// Usage
await sendFriendRequest('janedoe');
```

### Get Friends List
```typescript
async function getFriends(): Promise<{ count: number; friends: any[] }> {
  return apiRequest('/friends/list');
}
```

### Get Pending Requests
```typescript
async function getPendingRequests() {
  return apiRequest('/friends/pending');
}

// Returns: { received: [...], sent: [...] }
```

### Accept/Reject Friend Request
```typescript
async function acceptFriendRequest(requestId: string) {
  return apiRequest(`/friends/accept/${requestId}`, { method: 'PUT' });
}

async function rejectFriendRequest(requestId: string) {
  return apiRequest(`/friends/reject/${requestId}`, { method: 'PUT' });
}
```

---

## Group APIs

### Create Group
```typescript
interface CreateGroupRequest {
  name: string;
  description?: string;
  memberInvitesAllowed?: boolean;
}

async function createGroup(data: CreateGroupRequest): Promise<Group> {
  return apiRequest<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Usage
const group = await createGroup({
  name: 'Trip to Bali',
  description: 'Vacation expenses',
  memberInvitesAllowed: false,
});
```

### Get All Groups
```typescript
async function getGroups(): Promise<{ count: number; groups: Group[] }> {
  return apiRequest('/groups');
}
```

### Get Group Details
```typescript
async function getGroup(groupId: string): Promise<{ group: Group }> {
  return apiRequest(`/groups/${groupId}`);
}
```

### Add Member from Friend List
```typescript
async function addMemberToGroup(groupId: string, friendId: string, role = 'member') {
  return apiRequest(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ friendId, role }),
  });
}
```

### Generate Email Invite
```typescript
async function generateGroupInvite(groupId: string, email: string) {
  return apiRequest(`/groups/${groupId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// Returns: { token, inviteLink, expiresAt }
```

### Accept Group Invite
```typescript
async function acceptGroupInvite(token: string) {
  return apiRequest(`/groups/invite/${token}/accept`, { method: 'POST' });
}
```

---

## Expense APIs

### Create Expense
```typescript
interface CreateExpenseRequest {
  description: string;
  amount: number;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: Array<{
    userId: string;
    share?: number; // Required for 'exact' and 'percentage'
  }>;
  groupId?: string;
  category?: string;
  notes?: string;
  date?: string;
}

async function createExpense(data: CreateExpenseRequest): Promise<Expense> {
  return apiRequest<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Usage - Equal Split
await createExpense({
  description: 'Dinner',
  amount: 100,
  splitType: 'equal',
  participants: [
    { userId: 'user1' },
    { userId: 'user2' },
    { userId: 'user3' },
  ],
  category: 'food',
});

// Usage - Exact Split
await createExpense({
  description: 'Shopping',
  amount: 100,
  splitType: 'exact',
  participants: [
    { userId: 'user1', share: 50 },
    { userId: 'user2', share: 30 },
    { userId: 'user3', share: 20 },
  ],
});

// Usage - Percentage Split
await createExpense({
  description: 'Rent',
  amount: 1000,
  splitType: 'percentage',
  participants: [
    { userId: 'user1', share: 50 }, // 50%
    { userId: 'user2', share: 30 }, // 30%
    { userId: 'user3', share: 20 }, // 20%
  ],
});
```

### Get Expenses
```typescript
async function getExpenses(params?: {
  groupId?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<Expense>> {
  const queryString = new URLSearchParams(params as any).toString();
  return apiRequest(`/expenses${queryString ? `?${queryString}` : ''}`);
}

// Usage
const expenses = await getExpenses({ groupId: 'group123', limit: 20 });
```

### Edit Expense
```typescript
async function editExpense(expenseId: string, data: Partial<CreateExpenseRequest>) {
  return apiRequest(`/expenses/${expenseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

### Delete Expense
```typescript
async function deleteExpense(expenseId: string) {
  return apiRequest(`/expenses/${expenseId}`, { method: 'DELETE' });
}
```

---

## Settlement & Balance APIs

### Create Settlement
```typescript
async function createSettlement(data: {
  paidTo: string;
  amount: number;
  groupId?: string;
  note?: string;
}) {
  return apiRequest('/settlements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Usage
await createSettlement({
  paidTo: 'userId123',
  amount: 50,
  note: 'Cash payment',
});
```

### Get Dashboard Summary (Main Feature!)
```typescript
async function getDashboardSummary(): Promise<BalanceSummary> {
  return apiRequest<BalanceSummary>('/settlements/dashboard/summary');
}

// Usage
const summary = await getDashboardSummary();
console.log(`You owe: $${summary.youOwe}`);
console.log(`You're owed: $${summary.youreOwed}`);
console.log(`Net balance: $${summary.netBalance}`);
```

### Get Detailed Balances
```typescript
async function getDetailedBalances() {
  return apiRequest('/settlements/dashboard/detailed');
}

// Returns: { youOwe: [...], youreOwed: [...] }
```

---

## Activity APIs

### Get Activity Feed
```typescript
async function getActivities(params?: {
  groupId?: string;
  activityType?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<Activity>> {
  const queryString = new URLSearchParams(params as any).toString();
  return apiRequest(`/activities${queryString ? `?${queryString}` : ''}`);
}

// Usage
const activities = await getActivities({ limit: 20 });
```

---

## Complete Example: React Component

```typescript
import { useState, useEffect } from 'react';

function Dashboard() {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getDashboardSummary();
        setSummary(data);
      } catch (error) {
        console.error('Failed to load dashboard', error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!summary) return <div>Failed to load</div>;

  return (
    <div className="dashboard">
      <div className="card">
        <h3>You Owe</h3>
        <p className="amount negative">${summary.youOwe.toFixed(2)}</p>
        <span>{summary.owedCount} people</span>
      </div>
      
      <div className="card">
        <h3>You're Owed</h3>
        <p className="amount positive">${summary.youreOwed.toFixed(2)}</p>
        <span>{summary.owedByCount} people</span>
      </div>
      
      <div className="card">
        <h3>Net Balance</h3>
        <p className={`amount ${summary.netBalance >= 0 ? 'positive' : 'negative'}`}>
          ${summary.netBalance.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
```

---

## Error Handling Pattern

```typescript
async function handleApiCall<T>(apiCall: () => Promise<T>) {
  try {
    return { data: await apiCall(), error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// Usage
const { data, error } = await handleApiCall(() => 
  createExpense({ ... })
);

if (error) {
  toast.error(error);
} else {
  toast.success('Expense created!');
}
```

---

## Common HTTP Status Codes

- `200` - Success
- `201` - Created (e.g., new expense, group)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `500` - Server Error

---

## Testing Checklist

### Authentication Flow
- [ ] Signup new user
- [ ] Login existing user
- [ ] Get current user
- [ ] Logout

### Friend System
- [ ] Send friend request
- [ ] View pending requests
- [ ] Accept friend request
- [ ] View friends list
- [ ] Remove friend

### Group Management
- [ ] Create group
- [ ] View groups
- [ ] Add member from friends
- [ ] Generate email invite
- [ ] Accept invite
- [ ] Update group settings
- [ ] Leave group

### Expenses
- [ ] Create expense (equal split)
- [ ] Create expense (exact split)
- [ ] Create expense (percentage split)
- [ ] Edit expense
- [ ] Delete expense
- [ ] View expenses

### Dashboard
- [ ] View balance summary
- [ ] View detailed balances
- [ ] Create settlement
- [ ] Verify balances update after expense
- [ ] Verify balances update after settlement

### Activities
- [ ] View activity feed
- [ ] Filter activities by group
- [ ] Paginate through activities

---

## Quick API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | No | Register new user |
| POST | `/auth/login` | No | Login user |
| POST | `/auth/logout` | Yes | Logout user |
| GET | `/user/current` | Yes | Get current user |
| PUT | `/user/update` | Yes | Update profile |
| POST | `/friends/request` | Yes | Send friend request |
| GET | `/friends/list` | Yes | Get friends |
| GET | `/friends/pending` | Yes | Get pending requests |
| POST | `/groups` | Yes | Create group |
| GET | `/groups` | Yes | Get all groups |
| POST | `/groups/:id/members` | Yes | Add member |
| POST | `/groups/:id/invite` | Yes | Generate invite |
| POST | `/expenses` | Yes | Create expense |
| GET | `/expenses` | Yes | Get expenses |
| PUT | `/expenses/:id` | Yes | Edit expense |
| DELETE | `/expenses/:id` | Yes | Delete expense |
| POST | `/settlements` | Yes | Create settlement |
| GET | `/settlements/dashboard/summary` | Yes | **Dashboard summary** |
| GET | `/settlements/dashboard/detailed` | Yes | Detailed balances |
| GET | `/activities` | Yes | Get activities |

---

## Notes

- All authenticated requests automatically use the JWT cookie
- No need to manually set Authorization headers
- Always include `credentials: 'include'` in fetch options
- All dates are in ISO 8601 format (UTC)
- All amounts are in decimal format (not cents)
- Server validates all inputs - handle error messages in UI
