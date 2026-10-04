import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import { normalizeAnswer, calculateScore, shuffle } from '../../utils/preview-grading';
import type { TaskWordDocument } from '../../../shared/types';

type PreviewItem = { word: string; meaning: string; answer: string; correct: boolean };
Page({
  data: { state: 'loading' as LoadState, taskId: '', title: '', words: [] as TaskWordDocument[], current: null as TaskWordDocument | null, index: 0, phase: 'memory', answers: {} as Record<string, string>, answer: '', score: 0, items: [] as PreviewItem[], practice: false },
  onLoad(options: Record<string, string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); },
  async load() {
    this.setData({ state: 'loading' });
    try {
      const result = await api.task.previewStudent(this.data.taskId);
      this.setData({ title: result.title, words: result.words, current: result.words[0] ?? null, index: 0, phase: 'memory', answers: {}, answer: '', items: [], practice: false, state: result.words.length ? 'ready' : 'empty' });
    } catch (error) { this.setData({ state: 'error' }); showError(error); }
  },
  next() {
    if (this.data.index + 1 >= this.data.words.length) return;
    const index = this.data.index + 1;
    const current = this.data.words[index];
    this.setData({ index, current, answer: current ? this.data.answers[current._id] ?? '' : '' });
  },
  previous() {
    if (this.data.index <= 0) return;
    const index = this.data.index - 1;
    const current = this.data.words[index];
    this.setData({ index, current, answer: current ? this.data.answers[current._id] ?? '' : '' });
  },
  startDictation() {
    if (this.data.phase !== 'memory' || this.data.index !== this.data.words.length - 1) return;
    const words = shuffle(this.data.words);
    this.setData({ words, current: words[0] ?? null, index: 0, phase: 'dictation', answers: {}, answer: '' });
  },
  onAnswer(event: WechatMiniprogram.Input) {
    const current = this.data.current;
    if (!current || this.data.phase !== 'dictation') return;
    this.setData({ answer: event.detail.value, answers: { ...this.data.answers, [current._id]: event.detail.value } });
  },
  submit() {
    if (this.data.phase !== 'dictation') return;
    const items = this.data.words.map((word) => {
      const answer = this.data.answers[word._id] ?? '';
      return { word: word.word, meaning: word.meaning, answer, correct: normalizeAnswer(answer) === normalizeAnswer(word.word) };
    });
    // Local demonstration only. Never calls formal submission, practice or progress APIs.
    this.setData({ items, score: calculateScore(items.filter((item) => item.correct).length, items.length), phase: 'result' });
  },
  practiceWrong() {
    const words = this.data.words.filter((word) => normalizeAnswer(this.data.answers[word._id] ?? '') !== normalizeAnswer(word.word));
    if (!words.length) { wx.showToast({ title: '本轮没有错词' }); return; }
    this.setData({ words, current: words[0] ?? null, index: 0, answers: {}, answer: '', phase: 'dictation', practice: true });
  },
});
