import { Card, CardDefinition } from '../types/card';
import { DeckType } from '../csv-loader';

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

export class DeckValidator {
  private static readonly VALIDATION_RULES = {
    MIN_CARDS: 3,
    MAX_CARDS: 100,
    MIN_VALUE_NAME_LENGTH: 1,
    MAX_VALUE_NAME_LENGTH: 50,
    MIN_DESCRIPTION_LENGTH: 5,
    MAX_DESCRIPTION_LENGTH: 500,
    EXPECTED_DECK_SIZES: {
      dev: 16,
      professional: 40,
      extended: 72,
      development: 12 // Flexible
    }
  };

  /**
   * Validate card definitions
   */
  static validateCardDefinitions(cards: CardDefinition[], deckType?: DeckType): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    // Check minimum cards
    if (cards.length < this.VALIDATION_RULES.MIN_CARDS) {
      errors.push({
        code: 'INSUFFICIENT_CARDS',
        message: `Deck must have at least ${this.VALIDATION_RULES.MIN_CARDS} cards, found ${cards.length}`,
        severity: 'error',
        value: cards.length.toString()
      });
    }

    // Check maximum cards
    if (cards.length > this.VALIDATION_RULES.MAX_CARDS) {
      errors.push({
        code: 'EXCESSIVE_CARDS',
        message: `Deck cannot exceed ${this.VALIDATION_RULES.MAX_CARDS} cards, found ${cards.length}`,
        severity: 'error',
        value: cards.length.toString()
      });
    }

    // Check deck size expectations
    if (deckType && deckType !== 'development') {
      const expectedSize = this.VALIDATION_RULES.EXPECTED_DECK_SIZES[deckType];
      if (expectedSize && cards.length !== expectedSize) {
        const severity = Math.abs(cards.length - expectedSize) > 5 ? 'warning' : 'info';
        warnings.push({
          code: 'UNEXPECTED_DECK_SIZE',
          message: `${deckType} deck has ${cards.length} cards, expected ${expectedSize}`,
          severity,
          value: `${cards.length}/${expectedSize}`
        });
      }
    }

    // Validate individual cards
    const valueNames = new Set<string>();
    cards.forEach((card, index) => {
      this.validateCard(card, index, valueNames, errors, warnings, info);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * Validate individual card
   */
  private static validateCard(
    card: CardDefinition, 
    index: number, 
    valueNames: Set<string>,
    errors: ValidationError[],
    warnings: ValidationError[],
    _info: ValidationError[]
  ): void {
    const cardContext = `Card ${index + 1}`;

    // Validate value_name
    if (!card.value_name || typeof card.value_name !== 'string') {
      errors.push({
        code: 'INVALID_VALUE_NAME',
        message: `${cardContext}: value_name is required and must be a string`,
        severity: 'error',
        field: 'value_name',
        value: String(card.value_name)
      });
    } else {
      const trimmed = card.value_name.trim();
      
      if (trimmed.length < this.VALIDATION_RULES.MIN_VALUE_NAME_LENGTH) {
        errors.push({
          code: 'VALUE_NAME_TOO_SHORT',
          message: `${cardContext}: value_name must be at least ${this.VALIDATION_RULES.MIN_VALUE_NAME_LENGTH} character`,
          severity: 'error',
          field: 'value_name',
          value: card.value_name
        });
      }

      if (trimmed.length > this.VALIDATION_RULES.MAX_VALUE_NAME_LENGTH) {
        warnings.push({
          code: 'VALUE_NAME_TOO_LONG',
          message: `${cardContext}: value_name is ${trimmed.length} characters, consider shortening (max ${this.VALIDATION_RULES.MAX_VALUE_NAME_LENGTH})`,
          severity: 'warning',
          field: 'value_name',
          value: card.value_name
        });
      }

      // Check for duplicates
      if (valueNames.has(trimmed.toLowerCase())) {
        errors.push({
          code: 'DUPLICATE_VALUE_NAME',
          message: `${cardContext}: duplicate value_name "${trimmed}"`,
          severity: 'error',
          field: 'value_name',
          value: card.value_name
        });
      } else {
        valueNames.add(trimmed.toLowerCase());
      }

      // Check for special characters that might cause issues
      if (/[<>\"'&]/.test(trimmed)) {
        warnings.push({
          code: 'SPECIAL_CHARACTERS',
          message: `${cardContext}: value_name contains special characters that might cause display issues`,
          severity: 'warning',
          field: 'value_name',
          value: card.value_name
        });
      }
    }

    // Validate description
    if (!card.description || typeof card.description !== 'string') {
      errors.push({
        code: 'INVALID_DESCRIPTION',
        message: `${cardContext}: description is required and must be a string`,
        severity: 'error',
        field: 'description',
        value: String(card.description)
      });
    } else {
      const trimmed = card.description.trim();
      
      if (trimmed.length < this.VALIDATION_RULES.MIN_DESCRIPTION_LENGTH) {
        warnings.push({
          code: 'DESCRIPTION_TOO_SHORT',
          message: `${cardContext}: description is ${trimmed.length} characters, consider adding more detail (min ${this.VALIDATION_RULES.MIN_DESCRIPTION_LENGTH})`,
          severity: 'warning',
          field: 'description',
          value: card.description
        });
      }

      if (trimmed.length > this.VALIDATION_RULES.MAX_DESCRIPTION_LENGTH) {
        warnings.push({
          code: 'DESCRIPTION_TOO_LONG',
          message: `${cardContext}: description is ${trimmed.length} characters, consider shortening (max ${this.VALIDATION_RULES.MAX_DESCRIPTION_LENGTH})`,
          severity: 'warning',
          field: 'description',
          value: card.description
        });
      }

      // Check for placeholder text
      if (/lorem ipsum|placeholder|todo|tbd|tba/i.test(trimmed)) {
        warnings.push({
          code: 'PLACEHOLDER_CONTENT',
          message: `${cardContext}: description appears to contain placeholder text`,
          severity: 'warning',
          field: 'description',
          value: card.description
        });
      }
    }
  }

  /**
   * Validate card instances (with IDs and positions)
   */
  static validateCards(cards: Card[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    // Check for duplicate IDs
    const cardIds = new Set<string>();
    const positions = new Map<string, Card[]>(); // pile -> cards

    cards.forEach((card, index) => {
      const cardContext = `Card ${index + 1} (${card.value_name})`;

      // Validate ID
      if (!card.id || typeof card.id !== 'string') {
        errors.push({
          code: 'INVALID_CARD_ID',
          message: `${cardContext}: card ID is required and must be a string`,
          severity: 'error',
          field: 'id',
          value: String(card.id)
        });
      } else if (cardIds.has(card.id)) {
        errors.push({
          code: 'DUPLICATE_CARD_ID',
          message: `${cardContext}: duplicate card ID "${card.id}"`,
          severity: 'error',
          field: 'id',
          value: card.id
        });
      } else {
        cardIds.add(card.id);
      }

      // Validate position
      if (!card.position || typeof card.position.x !== 'number' || typeof card.position.y !== 'number') {
        errors.push({
          code: 'INVALID_POSITION',
          message: `${cardContext}: position must have numeric x and y coordinates`,
          severity: 'error',
          field: 'position',
          value: JSON.stringify(card.position)
        });
      }

      // Validate pile
      const validPiles = ['deck', 'staging', 'more', 'less', 'top8', 'top3', 'discard'];
      if (!card.pile || !validPiles.includes(card.pile)) {
        errors.push({
          code: 'INVALID_PILE',
          message: `${cardContext}: pile must be one of ${validPiles.join(', ')}`,
          severity: 'error',
          field: 'pile',
          value: card.pile
        });
      } else {
        // Track cards per pile
        if (!positions.has(card.pile)) {
          positions.set(card.pile, []);
        }
        positions.get(card.pile)!.push(card);
      }

      // Validate owner
      if (card.owner && typeof card.owner !== 'string') {
        warnings.push({
          code: 'INVALID_OWNER',
          message: `${cardContext}: owner should be a string`,
          severity: 'warning',
          field: 'owner',
          value: String(card.owner)
        });
      }
    });

    // Validate pile constraints
    this.validatePileConstraints(positions, warnings, errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * Validate pile-specific constraints
   */
  private static validatePileConstraints(
    positions: Map<string, Card[]>,
    warnings: ValidationError[],
    errors: ValidationError[]
  ): void {
    // Check top8 pile constraint
    const top8Cards = positions.get('top8') || [];
    if (top8Cards.length > 8) {
      errors.push({
        code: 'TOP8_CONSTRAINT_VIOLATION',
        message: `Top 8 pile has ${top8Cards.length} cards, maximum allowed is 8`,
        severity: 'error',
        field: 'pile',
        value: 'top8'
      });
    }

    // Check top3 pile constraint
    const top3Cards = positions.get('top3') || [];
    if (top3Cards.length > 3) {
      errors.push({
        code: 'TOP3_CONSTRAINT_VIOLATION',
        message: `Top 3 pile has ${top3Cards.length} cards, maximum allowed is 3`,
        severity: 'error',
        field: 'pile',
        value: 'top3'
      });
    }

    // Warn about empty critical piles in certain contexts
    if (top3Cards.length === 0 && positions.size > 1) {
      warnings.push({
        code: 'EMPTY_FINAL_PILE',
        message: 'Top 3 pile is empty - session might not be complete',
        severity: 'warning',
        field: 'pile',
        value: 'top3'
      });
    }
  }

  /**
   * Performance validation for large datasets
   */
  static validatePerformance(participantCount: number, cardsPerParticipant: number): ValidationResult {
    const totalCards = participantCount * cardsPerParticipant;
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    if (participantCount > 50) {
      warnings.push({
        code: 'HIGH_PARTICIPANT_COUNT',
        message: `${participantCount} participants may impact performance (recommended: ≤50)`,
        severity: 'warning',
        value: participantCount.toString()
      });
    }

    if (totalCards > 2000) {
      warnings.push({
        code: 'HIGH_CARD_COUNT',
        message: `${totalCards} total cards may impact performance (recommended: ≤2000)`,
        severity: 'warning',
        value: totalCards.toString()
      });
    }

    if (totalCards > 5000) {
      errors.push({
        code: 'EXCESSIVE_CARD_COUNT',
        message: `${totalCards} total cards exceeds performance limits (maximum: 5000)`,
        severity: 'error',
        value: totalCards.toString()
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * Generate validation summary
   */
  static generateSummary(result: ValidationResult): string {
    const { errors, warnings, info } = result;
    const parts = [];

    if (errors.length > 0) {
      parts.push(`❌ ${errors.length} error${errors.length !== 1 ? 's' : ''}`);
    }

    if (warnings.length > 0) {
      parts.push(`⚠️  ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);
    }

    if (info.length > 0) {
      parts.push(`ℹ️  ${info.length} info message${info.length !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return '✅ All validation checks passed';
    }

    return parts.join(', ');
  }
}
