import { Injectable } from '@angular/core';

import { FlashcardLevel } from '../models/flashcard-level.model';
import { FlashcardLesson } from '../models/flashcard-lesson.model';
import { Flashcard } from '../models/flashcard.model';

@Injectable({
    providedIn: 'root'
})
export class FlashcardService {

    private readonly levels: FlashcardLevel[] = [
        {
            id: 'n5',
            code: 'N5',
            name: 'JLPT N5',
            description: 'Beginner level',
            lessonCount: 24
        },
        {
            id: 'n4',
            code: 'N4',
            name: 'JLPT N4',
            description: 'Elementary level',
            lessonCount: 24
        },
        {
            id: 'n3',
            code: 'N3',
            name: 'JLPT N3',
            description: 'Intermediate level',
            lessonCount: 20
        },
        {
            id: 'n2',
            code: 'N2',
            name: 'JLPT N2',
            description: 'Upper-intermediate level',
            lessonCount: 20
        },
        {
            id: 'n1',
            code: 'N1',
            name: 'JLPT N1',
            description: 'Advanced level',
            lessonCount: 20
        }
    ];

    private readonly lessons: FlashcardLesson[] = [
        {
            id: 'n5-lesson-01',
            levelId: 'n5',
            lessonNumber: 1,
            title: 'Basic Vocabulary',
            description: 'Basic Japanese vocabulary',
            vocabularyCount: 25
        },
        {
            id: 'n5-lesson-02',
            levelId: 'n5',
            lessonNumber: 2,
            title: 'Daily Activities',
            description: 'Vocabulary about daily activities',
            vocabularyCount: 30
        },
        {
            id: 'n5-lesson-03',
            levelId: 'n5',
            lessonNumber: 3,
            title: 'Time',
            description: 'Vocabulary about time and dates',
            vocabularyCount: 28
        }
    ];

    private readonly flashcards: Flashcard[] = [
        {
            id: 'card-001',
            lessonId: 'n5-lesson-01',
            word: '食べる',
            reading: 'たべる',
            meaning: 'to eat',
            exampleSentence: 'ご飯を食べる。',
            exampleTranslation: 'Ăn cơm.'
        },
        {
            id: 'card-002',
            lessonId: 'n5-lesson-01',
            word: '飲む',
            reading: 'のむ',
            meaning: 'to drink',
            exampleSentence: '水を飲む。',
            exampleTranslation: 'Uống nước.'
        },
        {
            id: 'card-003',
            lessonId: 'n5-lesson-01',
            word: '行く',
            reading: 'いく',
            meaning: 'to go',
            exampleSentence: '学校へ行く。',
            exampleTranslation: 'Đi đến trường.'
        }
    ];

    getLevelById(levelId: string): FlashcardLevel | undefined {
        return this.levels.find(level => level.id === levelId);
    }

    getLessonsByLevel(levelId: string): FlashcardLesson[] {
        return this.lessons.filter(lesson => lesson.levelId === levelId);
    }

    getLessonById(lessonId: string): FlashcardLesson | undefined {
        return this.lessons.find(lesson => lesson.id === lessonId);
    }

    getFlashcardsByLesson(lessonId: string): Flashcard[] {
        return this.flashcards.filter(
            flashcard => flashcard.lessonId === lessonId
        );
    }
}