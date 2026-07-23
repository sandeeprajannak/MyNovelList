import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/services/supabaseAdmin';
import { validateApiKey } from '$lib/services/apiKeyValidator.server';
import type { ProgressInput } from '$lib/types';

async function validateRequest(request: Request): Promise<{ userId: string; scopes: string[] } | Response> {
	const authHeader = request.headers.get('Authorization');
	
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return json({ success: false, error: 'Missing or invalid Authorization header' }, { status: 401 });
	}

	const apiKey = authHeader.substring(7);
	const validation = await validateApiKey(apiKey);

	if (!validation) {
		return json({ success: false, error: 'Invalid or expired API key' }, { status: 401 });
	}

	return validation;
}

// GET /api/v1/novels/:id/progress - Get user's progress on a novel
export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await validateRequest(request);
	if (auth instanceof Response) return auth;

	if (!auth.scopes.includes('read')) {
		return json({ success: false, error: 'API key does not have read permission' }, { status: 403 });
	}

	const { data: progress, error } = await supabaseAdmin
		.from('novel_progress')
		.select('*')
		.eq('novel_id', params.id)
		.eq('user_id', auth.userId)
		.single();

	if (error || !progress) {
		return json({ success: false, error: 'Progress not found' }, { status: 404 });
	}

	return json({ success: true, data: progress });
};

// POST /api/v1/novels/:id/progress - Add novel to library / create progress
export const POST: RequestHandler = async ({ request, params }) => {
	const auth = await validateRequest(request);
	if (auth instanceof Response) return auth;

	if (!auth.scopes.includes('write')) {
		return json({ success: false, error: 'API key does not have write permission' }, { status: 403 });
	}

	// Check if novel exists
	const { data: novel, error: novelError } = await supabaseAdmin
		.from('novels')
		.select('id')
		.eq('id', params.id)
		.single();

	if (novelError || !novel) {
		return json({ success: false, error: 'Novel not found' }, { status: 404 });
	}

	// Check if already in library
	const { data: existing } = await supabaseAdmin
		.from('novel_progress')
		.select('*')
		.eq('novel_id', params.id)
		.eq('user_id', auth.userId)
		.single();

	if (existing) {
		return json({ success: false, error: 'Novel already in library' }, { status: 409 });
	}

	let body: ProgressInput = {};
	try {
		body = await request.json();
	} catch {
		// Empty body is fine, use defaults
	}

	const { data: progress, error } = await supabaseAdmin
		.from('novel_progress')
		.insert({
			user_id: auth.userId,
			novel_id: params.id,
			status: body.status || 'planning',
			current_chapter: body.current_chapter || 0,
			score: body.score,
			notes: body.notes,
			started_at: body.started_at,
			completed_at: body.completed_at
		})
		.select()
		.single();

	if (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}

	return json({ success: true, data: progress }, { status: 201 });
};

// PUT /api/v1/novels/:id/progress - Update user's progress
export const PUT: RequestHandler = async ({ request, params }) => {
	const auth = await validateRequest(request);
	if (auth instanceof Response) return auth;

	if (!auth.scopes.includes('write')) {
		return json({ success: false, error: 'API key does not have write permission' }, { status: 403 });
	}

	let body: ProgressInput & { chapter?: number; increment?: number };
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	// Get current progress
	const { data: current, error: fetchError } = await supabaseAdmin
		.from('novel_progress')
		.select('*')
		.eq('novel_id', params.id)
		.eq('user_id', auth.userId)
		.single();

	if (fetchError || !current) {
		return json({ success: false, error: 'Progress not found. Add novel to library first.' }, { status: 404 });
	}

	// Calculate new chapter
	let newChapter = current.current_chapter;
	if (body.current_chapter !== undefined) {
		newChapter = body.current_chapter;
	} else if (body.chapter !== undefined) {
		newChapter = body.chapter;
	} else if (body.increment !== undefined) {
		newChapter = current.current_chapter + body.increment;
	}

	const updates: Record<string, any> = {
		current_chapter: Math.max(0, newChapter),
		updated_at: new Date().toISOString()
	};

	if (body.status !== undefined) updates.status = body.status;
	if (body.score !== undefined) updates.score = body.score;
	if (body.notes !== undefined) updates.notes = body.notes;
	if (body.started_at !== undefined) updates.started_at = body.started_at;
	if (body.completed_at !== undefined) updates.completed_at = body.completed_at;

	// Auto-set to reading if was planning and chapter > 0
	if (current.status === 'planning' && newChapter > 0 && !body.status) {
		updates.status = 'reading';
	}

	const { data: progress, error } = await supabaseAdmin
		.from('novel_progress')
		.update(updates)
		.eq('novel_id', params.id)
		.eq('user_id', auth.userId)
		.select()
		.single();

	if (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}

	// total_chapters is a fact about the source material, not user-owned progress,
	// so any tracker reporting it can update it here (unlike novels.* metadata,
	// which is restricted to the creator via PUT/PATCH /api/v1/novels/:id).
	let total_chapters: number | undefined;
	if (body.total_chapters !== undefined) {
		const { data: novel, error: novelError } = await supabaseAdmin
			.from('novels')
			.update({ total_chapters: body.total_chapters, updated_at: new Date().toISOString() })
			.eq('id', params.id)
			.select('total_chapters')
			.single();

		if (novelError) {
			return json({ success: false, error: novelError.message }, { status: 500 });
		}
		total_chapters = novel.total_chapters;
	}

	return json({ success: true, data: { ...progress, total_chapters } });
};

// DELETE /api/v1/novels/:id/progress - Remove from library
export const DELETE: RequestHandler = async ({ request, params }) => {
	const auth = await validateRequest(request);
	if (auth instanceof Response) return auth;

	if (!auth.scopes.includes('delete')) {
		return json({ success: false, error: 'API key does not have delete permission' }, { status: 403 });
	}

	const { error } = await supabaseAdmin
		.from('novel_progress')
		.delete()
		.eq('novel_id', params.id)
		.eq('user_id', auth.userId);

	if (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}

	return json({ success: true, data: { removed: true } });
};
