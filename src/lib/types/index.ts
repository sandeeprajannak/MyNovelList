export type NovelStatus = 'planning' | 'reading' | 'completed' | 'on_hold' | 'dropped';

// Novel metadata (shared/public)
export interface Novel {
	id: string;
	user_id: string; // who added this novel
	title: string;
	author?: string;
	cover_url?: string;
	source_url?: string;
	total_chapters?: number;
	tags: string[];
	created_at: string;
	updated_at: string;
}

// User's private progress on a novel
export interface NovelProgress {
	id: string;
	user_id: string;
	novel_id: string;
	status: NovelStatus;
	current_chapter: number;
	score?: number;
	notes?: string;
	started_at?: string;
	completed_at?: string;
	created_at: string;
	updated_at: string;
}

// Combined view for user's library
export interface NovelWithProgress extends Novel {
	progress?: NovelProgress;
}

export interface NovelInput {
	title: string;
	author?: string;
	cover_url?: string;
	source_url?: string;
	total_chapters?: number;
	tags?: string[];
}

export interface ProgressInput {
	status?: NovelStatus;
	current_chapter?: number;
	total_chapters?: number;
	score?: number;
	notes?: string;
	started_at?: string;
	completed_at?: string;
}

export interface Profile {
	id: string;
	username?: string;
	display_name?: string;
	created_at: string;
	updated_at: string;
}

export interface TierConfig {
	name: string;
	color: string;
}

export interface TierList {
	id: string;
	user_id: string;
	title: string;
	description?: string;
	is_public: boolean;
	tiers: TierConfig[];
	created_at: string;
	updated_at: string;
}

export interface TierListItem {
	id: string;
	tier_list_id: string;
	novel_id?: string;
	title?: string;
	cover_url?: string;
	tier_name: string;
	position: number;
	created_at: string;
	// Joined data
	novel?: Novel;
}

export interface TierListWithItems extends TierList {
	items: TierListItem[];
}

export interface FilterOptions {
	status?: NovelStatus | 'all';
	scoreMin?: number;
	scoreMax?: number;
	tags?: string[];
	search?: string;
}

export interface SortOptions {
	field: 'title' | 'score' | 'created_at' | 'updated_at' | 'current_chapter';
	direction: 'asc' | 'desc';
}

export interface ExportData {
	version: string;
	exported_at: string;
	novels: Novel[];
	tier_lists: TierListWithItems[];
}

export type ApiScope = 'read' | 'write' | 'delete';

export interface ApiKey {
	id: string;
	user_id: string;
	name: string;
	key_prefix: string;
	scopes: ApiScope[];
	last_used_at?: string;
	request_count: number;
	is_active: boolean;
	created_at: string;
	expires_at?: string;
}

export interface ApiKeyWithSecret extends ApiKey {
	secret: string; // Only returned on creation
}

// API Response types
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface ApiNovelListResponse {
	novels: Novel[];
	total: number;
	page: number;
	per_page: number;
}
