import { App, MarkdownPostProcessorContext, parseYaml, RequestUrlParam, requestUrl, ButtonComponent, DropdownComponent, setIcon, Notice } from 'obsidian';
import { MalApiClient } from '../api/MalApiClient';
import { AnimeFileService } from '../services/AnimeFileService';
import { AnimeStatistics } from '../api/types';

export class AnimeLogProcessor {
    static async postProcess(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, app: App, apiClient: MalApiClient, fileService: AnimeFileService) {
        const container = el.createDiv({ cls: 'anime-log-container' });

        // Parse YAML
        let params: any = {};
        try {
            params = parseYaml(source) || {};
        } catch (e) {
            container.createEl('div', { text: 'animeLogブロックのパースエラー', cls: 'error' });
            return;
        }

        // Get Anime ID
        // 1. Check code block params (most robust)
        let animeId = params.mal_id;

        // 2. Check Metadata Cache
        if (!animeId) {
            const cache = app.metadataCache.getCache(ctx.sourcePath);
            if (cache && cache.frontmatter && cache.frontmatter.mal_id) {
                animeId = cache.frontmatter.mal_id;
            }
        }

        // 3. Fallback: Read file directly
        if (!animeId) {
            const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
            if (file && 'read' in file) {
                const content = await app.vault.read(file as any);
                // Regex to find mal_id in frontmatter (relaxed)
                const match = content.match(/mal_id:\s*(\d+)/);
                if (match) {
                    animeId = parseInt(match[1]);
                }
            }
        }

        if (!animeId) {
            container.createEl('div', { text: `Error: Anime ID not found. (Path: ${ctx.sourcePath})`, cls: 'error' });
            const btn = container.createEl('button', { text: 'Reload' });
            btn.onclick = () => {
                container.empty();
                AnimeLogProcessor.postProcess(source, el, ctx, app, apiClient, fileService);
            };
            return;
        }

        // --- Status UI ---
        const statusContainer = container.createDiv({ cls: 'anime-log-section anime-status' });
        statusContainer.createEl('h4', { text: 'ステータス' });
        const dropdown = new DropdownComponent(statusContainer);
        const savedStatus = params.status || 'plan_to_watch';

        const statusMap: Record<string, string> = {
            'plan_to_watch': '見たい',
            'watching': '視聴中',
            'completed': '視聴済み',
            'on_hold': '中断',
            'dropped': '視聴中止'
        };

        Object.keys(statusMap).forEach(key => {
            dropdown.addOption(key, statusMap[key]);
        });

        dropdown.setValue(savedStatus);

        dropdown.onChange(async (newStatus) => {
            const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
            // TFile判定: TFileには extension プロパティがある
            if (file && 'extension' in file) {
                const content = await app.vault.read(file as any);
                const newContent = content.replace(/(```animeLog\s*\n)([\s\S]*?)(\n```)/, (match, prefix, body, suffix) => {
                    if (body.includes('status:')) {
                        return `${prefix}${body.replace(/status:\s*.*/, `status: ${newStatus}`)}${suffix}`;
                    }
                    const newBody = body.trimEnd() + `\nstatus: ${newStatus}`;
                    return `${prefix}${newBody}${suffix}`;
                });

                if (newContent !== content) {
                    await app.vault.modify(file as any, newContent);
                    new Notice('ステータスを更新しました');
                } else {
                    new Notice('DEBUG: 正規表現がマッチしませんでした');
                    console.log('Content:', content.substring(0, 500));
                }
            } else {
                new Notice(`DEBUG: TFile not found. file=${file}, path=${ctx.sourcePath}`);
            }
        });

        // --- Fetch API Details ---
        const detailsContainer = container.createDiv({ cls: 'anime-log-details-loading' });
        detailsContainer.setText('詳細情報を読み込み中...');

        try {
            // detail取得前に少し待機してAPI負荷軽減などを考慮しても良いが、まずは直接呼ぶ
            // APIエラー時にはコンソールだけでなくUIに表示する
            const details = await apiClient.getAnimeDetails(animeId);
            detailsContainer.empty();
            detailsContainer.removeClass('anime-log-details-loading');
            detailsContainer.addClass('anime-log-details');

            // 1. Statistics
            if (details.statistics) {
                const statBox = detailsContainer.createDiv({ cls: 'anime-log-section anime-stats' });
                statBox.createEl('h4', { text: '統計情報' });
                const grid = statBox.createDiv({ cls: 'anime-stats-grid' });

                const stats = details.statistics;
                const total = stats.num_list_users;

                const createStatItem = (label: string, val: string) => {
                    const item = grid.createDiv({ cls: 'anime-stat-item' });
                    item.createDiv({ cls: 'label', text: label });
                    // Provide comma separation if the value is a number string
                    let displayVal = val;
                    if (!isNaN(Number(val))) {
                        displayVal = Number(val).toLocaleString();
                    }
                    item.createDiv({ cls: 'value', text: displayVal });
                };

                createStatItem('視聴中', stats.status.watching);
                createStatItem('完了', stats.status.completed);
                createStatItem('保留', stats.status.on_hold);
                createStatItem('中止', stats.status.dropped);
                createStatItem('見たい', stats.status.plan_to_watch);
                createStatItem('総数', total.toString());
            }

            // 2. Pictures
            if (details.pictures && details.pictures.length > 0) {
                const picSection = detailsContainer.createDiv({ cls: 'anime-log-section anime-pictures' });
                picSection.createEl('h4', { text: '画像' });
                const scrollContainer = picSection.createDiv({ cls: 'horizontal-scroll-container' });

                details.pictures.forEach(pic => {
                    const img = scrollContainer.createEl('img', { attr: { src: pic.medium } });
                });
            }

            // 3. Related Anime
            if (details.related_anime && details.related_anime.length > 0) {
                const relatedSection = detailsContainer.createDiv({ cls: 'anime-log-section anime-related' });
                relatedSection.createEl('h4', { text: '関連アニメ' });
                const scrollContainer = relatedSection.createDiv({ cls: 'horizontal-scroll-container' });

                details.related_anime.forEach((rel: any) => {
                    const card = scrollContainer.createDiv({ cls: 'anime-card mini-card' });
                    const imgUrl = rel.node.main_picture ? rel.node.main_picture.medium : '';
                    if (imgUrl) {
                        card.createEl('img', { attr: { src: imgUrl } });
                    }

                    const title = rel.node.alternative_titles?.ja || rel.node.title;
                    const relation = rel.relation_type_formatted || rel.relation_type;

                    // Display relation type and title
                    const infoDiv = card.createDiv({ cls: 'anime-card-info' });
                    infoDiv.createDiv({ cls: 'anime-card-relation', text: relation });
                    infoDiv.createDiv({ cls: 'anime-card-title', text: title });

                    card.addEventListener('click', async () => {
                        const existing = await fileService.getAnimeFile(rel.node.id);
                        if (existing) {
                            await fileService.openFile(existing);
                        } else {
                            new Notice(`${title} のログを作成中...`);
                            try {
                                const newFile = await fileService.createAnimeFile(rel.node);
                                await fileService.openFile(newFile);
                            } catch (e) {
                                new Notice('ファイル作成に失敗しました');
                                console.error(e);
                            }
                        }
                    });
                });
            }

            // 4. Recommendations
            if (details.recommendations && details.recommendations.length > 0) {
                const recSection = detailsContainer.createDiv({ cls: 'anime-log-section anime-recommendations' });
                recSection.createEl('h4', { text: 'おすすめアニメ' });
                const scrollContainer = recSection.createDiv({ cls: 'horizontal-scroll-container' });

                details.recommendations.forEach(rec => {
                    const card = scrollContainer.createDiv({ cls: 'anime-card mini-card' });
                    const imgUrl = rec.node.main_picture ? rec.node.main_picture.medium : '';
                    if (imgUrl) {
                        card.createEl('img', { attr: { src: imgUrl } });
                    }

                    const title = rec.node.alternative_titles?.ja || rec.node.title;
                    card.createDiv({ cls: 'anime-card-title', text: title });

                    card.addEventListener('click', async () => {
                        const existing = await fileService.getAnimeFile(rec.node.id);
                        if (existing) {
                            await fileService.openFile(existing);
                        } else {
                            new Notice(`${title} のログを作成中...`);
                            // Create file logic:
                            try {
                                const newFile = await fileService.createAnimeFile(rec.node);
                                await fileService.openFile(newFile);
                            } catch (e) {
                                new Notice('ファイル作成に失敗しました');
                                console.error(e);
                            }
                        }
                    });
                });
            }

        } catch (err) {
            detailsContainer.setText('詳細情報の読み込みに失敗しました。');
            detailsContainer.addClass('error');
            console.error('Anime Log Details Error:', err);
            new Notice('APIエラー: 詳細情報を取得できませんでした');
        }
    }
}
