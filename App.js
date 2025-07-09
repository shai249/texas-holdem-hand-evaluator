import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hand } from 'pokersolver';
import { captureRef } from 'react-native-view-shot';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';

const STORAGE_KEY = '@texas_holdem_players';
const SETTINGS_KEY = '@texas_holdem_settings';

const suits = [
  { symbol: '♠️', code: 's' },
  { symbol: '♥️', code: 'h' },
  { symbol: '♦️', code: 'd' },
  { symbol: '♣️', code: 'c' },
];

const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export default function App() {
  const colorScheme = useColorScheme();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settings, setSettings] = useState({
    darkMode: colorScheme === 'dark',
    showCardSuits: true,
    cardSize: 'medium', // small, medium, large
  });

  // Use settings.darkMode override if set
  const isDark = settings.darkMode;

  const colors = {
    backgroundGradient: isDark
      ? ['#000428', '#004e92']
      : ['#1e3c72', '#2a5298'],
    textPrimary: isDark ? '#fff' : '#111',
    textSecondary: isDark ? '#ccc' : '#eee',
    cardRankRed: '#ef4444',
    modalBackground: isDark ? '#222' : '#fff',
    modalOverlay: '#000000aa',
    buttonBackground: '#22c55e',
    buttonText: '#fff',
    buttonDanger: '#ef4444',
  };

  const [players, setPlayers] = useState([]);
  const [community, setCommunity] = useState(['', '', '', '', '']);
  const [results, setResults] = useState([]);

  const [cardPickerVisible, setCardPickerVisible] = useState(false);
  const [onSelectCard, setOnSelectCard] = useState(() => () => { });
  const [selectedSuit, setSelectedSuit] = useState(null);

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  // Ref for capturing results view
  const resultsRef = useRef();

  // Load players from storage
  useEffect(() => {
    (async () => {
      try {
        const savedPlayers = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedPlayers) {
          setPlayers(JSON.parse(savedPlayers));
        }
      } catch (e) {
        console.warn('Failed to load players from storage', e);
      }
    })();
  }, []);

  // Save players on change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(players));
      } catch (e) {
        console.warn('Failed to save players to storage', e);
      }
    })();
  }, [players]);

  // Load settings from storage
  useEffect(() => {
    (async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
      }
    })();
  }, []);

  // Save settings on change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        console.warn('Failed to save settings', e);
      }
    })();
  }, [settings]);

  const clearCards = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setPlayers([]);
      setCommunity(['', '', '', '', '']);
      setResults([]);
      alert('All cards cleared and saved data reset!');
    } catch (e) {
      alert('Failed to clear cards and saved data.');
    }
  };

  const parseCard = (card) => {
    if (!card || card.length < 2) return { rank: '', suit: '', color: '#ccc' };
    const rank = card[0];
    const suitCode = card[1];
    const suitMap = {
      s: '♠️',
      h: '♥️',
      d: '♦️',
      c: '♣️',
    };
    const isRedSuit = suitCode === 'h' || suitCode === 'd';
    const color = isRedSuit
      ? colors.cardRankRed
      : isDark
        ? '#1f2937'
        : '#1f2937';
    return { rank, suit: suitMap[suitCode], color };
  };

  const getUsedCards = () => {
    const playerCards = players.flatMap((p) => p.cards);
    return [...playerCards, ...community].filter(Boolean);
  };

  const openCardPicker = (onSelect) => {
    setOnSelectCard(() => onSelect);
    setSelectedSuit(null);
    setCardPickerVisible(true);
  };

  const selectCard = (rank) => {
    if (!selectedSuit) return;
    const card = `${rank}${selectedSuit}`;
    const used = getUsedCards();

    if (used.includes(card)) {
      alert('This card has already been selected!');
      return;
    }

    onSelectCard(card);
    setCardPickerVisible(false);
  };

  const setPlayerCard = (playerIndex, cardIndex, value) => {
    const newPlayers = [...players];
    newPlayers[playerIndex].cards[cardIndex] = value;
    setPlayers(newPlayers);
  };

  const setCommunityCard = (index, value) => {
    const newCommunity = [...community];
    newCommunity[index] = value;
    setCommunity(newCommunity);
  };

  const evaluate = () => {
    if (players.length < 2) {
      alert('At least 2 players are required to evaluate.');
      return;
    }

    const communityCards = community.filter(Boolean);
    if (communityCards.length !== 5) {
      alert('Please select 5 community cards.');
      return;
    }

    try {
      const hands = players.map((p) => {
        if (p.cards.some((c) => !c)) throw new Error();
        const combined = [...p.cards, ...communityCards];
        const bestHand = Hand.solve(combined);
        return { ...p, bestHand };
      });

      const winners = Hand.winners(hands.map((p) => p.bestHand));

      setResults(
        hands.map((p) => ({
          name: p.name,
          description: p.bestHand.descr,
          isWinner: winners.includes(p.bestHand),
        }))
      );
    } catch {
      alert('Please ensure all players have 2 cards.');
    }
  };

  // Share results as image
  const shareResults = async () => {
    if (Platform.OS === 'web') {
      const summary = results.map(r => `${r.name}: ${r.description}${r.isWinner ? ' 🏆' : ''}`).join('\n');
      navigator.clipboard.writeText(summary);
      alert('Results copied to clipboard!');
      return;
    }

    if (!resultsRef.current) {
      alert('Nothing to share!');
      return;
    }

    try {
      const uri = await captureRef(resultsRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri);
    } catch (e) {
      alert('Failed to share results: ' + e.message);
    }
  };

  // Updated renderCard using settings.cardSize and settings.showCardSuits
  const renderCard = (card, onPress) => {
    const { rank, suit, color } = parseCard(card);
    const cardWidth =
      settings.cardSize === 'small'
        ? 40
        : settings.cardSize === 'large'
          ? 70
          : 50;
    const cardHeight =
      settings.cardSize === 'small'
        ? 56
        : settings.cardSize === 'large'
          ? 100
          : 70;

    return (
      <TouchableOpacity
        style={[
          styles.cardContainer,
          {
            backgroundColor: '#fff',
            shadowColor: '#000',
            width: cardWidth,
            height: cardHeight,
          },
        ]}
        onPress={onPress}>
        {rank && (settings.showCardSuits ? suit : true) ? (
          <>
            <Text style={[styles.cardRank, { color }]}>{rank}</Text>
            {settings.showCardSuits && (
              <Text
                style={[
                  styles.cardSuit,
                  color === colors.cardRankRed && styles.cardSuitRed,
                ]}>
                {suit}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.cardPlaceholder, { color: '#444' }]}>＋</Text>
        )}
      </TouchableOpacity>
    );
  };

  const openNameModal = () => {
    setNewPlayerName('');
    setNameModalVisible(true);
  };

  const addPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (trimmed.length === 0) {
      alert('Please enter a valid player name.');
      return;
    }
    setPlayers([...players, { name: trimmed, cards: ['', ''] }]);
    setNameModalVisible(false);
  };

  const usedCards = getUsedCards();

  const styles = StyleSheet.create({
    container: {
      paddingTop: 60,
      paddingHorizontal: 16,
      paddingBottom: 40,
      backgroundColor: 'transparent',
    },
    title: {
      fontSize: 26,
      fontWeight: 'bold',
      color: '#fff',
      textAlign: 'center',
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 10,
    },
    centeredRow: {
      justifyContent: 'center',
    },
    cardContainer: {
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 5,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    cardRank: {
      fontSize: 22,
      fontWeight: 'bold',
    },
    cardSuit: {
      fontSize: 18,
    },
    cardSuitRed: {
      color: colors.cardRankRed,
    },
    cardPlaceholder: {
      fontSize: 28,
    },
    playerSection: {
      marginVertical: 12,
      paddingBottom: 10,
      borderBottomColor: isDark ? '#444' : '#444',
      borderBottomWidth: 1,
    },
    playerName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
      marginBottom: 6,
    },
    button: {
      backgroundColor: colors.buttonBackground,
      padding: 14,
      borderRadius: 10,
      marginVertical: 6,
      alignItems: 'center',
      minWidth: 90,
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
    results: {
      backgroundColor: colors.modalBackground,
      marginTop: 20,
      padding: 12,
      borderRadius: 10,
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
      color: colors.textPrimary,
    },
    resultText: {
      fontSize: 16,
      marginBottom: 6,
      color: colors.textPrimary,
    },
    winner: {
      color: 'limegreen',
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: colors.modalBackground,
      borderRadius: 12,
      padding: 20,
      maxHeight: '80%',
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
    },
    modalSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 10,
      marginBottom: 6,
      color: colors.textPrimary,
    },
    suitButton: {
      backgroundColor: isDark ? '#444' : '#eee',
      borderRadius: 10,
      padding: 10,
      margin: 5,
      minWidth: 50,
      alignItems: 'center',
    },
    suitSelected: {
      backgroundColor: '#38bdf8',
    },
    suitText: {
      fontSize: 24,
      textAlign: 'center',
      color: isDark ? '#fff' : '#000',
    },
    rankGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    rankButton: {
      backgroundColor: isDark ? '#666' : '#f3f4f6',
      padding: 12,
      margin: 6,
      borderRadius: 10,
      width: 50,
      alignItems: 'center',
    },
    rankText: {
      fontSize: 18,
      fontWeight: '500',
      color: isDark ? '#fff' : '#111',
    },
    closeBtn: {
      backgroundColor: colors.buttonDanger,
      padding: 12,
      borderRadius: 10,
      marginTop: 16,
      alignItems: 'center',
    },
    input: {
      borderColor: isDark ? '#666' : '#ccc',
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: isDark ? '#fff' : '#111',
      backgroundColor: isDark ? '#222' : '#fff',
    },
    disabledButton: {
      backgroundColor: isDark ? '#555' : '#ddd',
    },
    disabledText: {
      color: isDark ? '#999' : '#999',
    },
  });

  return (
    <LinearGradient colors={colors.backgroundGradient} style={{ flex: 1 }}>
      <StatusBar style={'light'} />

      {/* Gear Icon button */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 50, right: 16, zIndex: 10 }}
        onPress={() => setSettingsVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="settings" size={28} color="#808080" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>♠ Texas Hold'em Evaluator</Text>

        <Text style={styles.label}>Community Cards</Text>
        <View style={styles.row}>
          {community.map((c, i) =>
            renderCard(c, () =>
              openCardPicker((card) => setCommunityCard(i, card))
            )
          )}
        </View>

        {players.map((p, pi) => (
          <View key={pi} style={styles.playerSection}>
            <Text style={styles.playerName}>{p.name}</Text>
            <View style={styles.row}>
              {p.cards.map((c, ci) =>
                renderCard(c, () =>
                  openCardPicker((card) => setPlayerCard(pi, ci, card))
                )
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.button} onPress={openNameModal}>
          <Text style={styles.buttonText}>Add Player</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={evaluate}>
          <Text style={styles.buttonText}>Evaluate Winner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.buttonDanger }]}
          onPress={clearCards}>
          <Text style={styles.buttonText}>Clear Cards</Text>
        </TouchableOpacity>

        {results.length > 0 && (
          <>
            <View ref={resultsRef} collapsable={false} style={styles.results}>
              <Text style={styles.resultTitle}>Results</Text>
              {results.map((r, i) => (
                <Text
                  key={i}
                  style={[styles.resultText, r.isWinner && styles.winner]}>
                  {r.name}: {r.description} {r.isWinner ? '🏆' : ''}
                </Text>
              ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={shareResults}>
              <Text style={styles.buttonText}>Share Results</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Card Picker Modal */}
        <Modal animationType="fade" transparent visible={cardPickerVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Pick a Card
              </Text>

              <Text style={styles.modalSubtitle}>Select Suit</Text>
              <View style={[styles.row, styles.centeredRow]}>
                {suits.map((suit) => {
                  const allPicked = ranks.every((rank) =>
                    usedCards.includes(rank + suit.code)
                  );
                  const isDisabled = allPicked;

                  return (
                    <TouchableOpacity
                      key={suit.code}
                      onPress={() => setSelectedSuit(suit.code)}
                      style={[
                        styles.suitButton,
                        selectedSuit === suit.code && styles.suitSelected,
                        isDisabled && styles.disabledButton,
                      ]}
                      disabled={isDisabled}>
                      <Text
                        style={[
                          styles.suitText,
                          isDisabled && styles.disabledText,
                        ]}>
                        {suit.symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedSuit && (
                <>
                  <Text style={styles.modalSubtitle}>Select Rank</Text>
                  <ScrollView style={{ maxHeight: 200 }}>
                    <View style={styles.rankGrid}>
                      {ranks.map((rank) => {
                        const card = rank + selectedSuit;
                        const isDisabled = usedCards.includes(card);
                        return (
                          <TouchableOpacity
                            key={rank}
                            onPress={() => selectCard(rank)}
                            style={[
                              styles.rankButton,
                              isDisabled && styles.disabledButton,
                            ]}
                            disabled={isDisabled}>
                            <Text
                              style={[
                                styles.rankText,
                                isDisabled && styles.disabledText,
                              ]}>
                              {rank}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setCardPickerVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add Player Modal */}
        <Modal animationType="fade" transparent visible={nameModalVisible}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Add New Player
              </Text>
              <TextInput
                style={styles.input}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                placeholder="Player Name"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoFocus
                onSubmitEditing={addPlayer}
              />
              <TouchableOpacity
                onPress={addPlayer}
                style={[styles.button, { marginTop: 10 }]}>
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setNameModalVisible(false)}
                style={styles.closeBtn}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Settings Modal */}
        <Modal animationType="slide" transparent visible={settingsVisible}>
          <View style={[styles.modalOverlay, { padding: 30 }]}>
            <View style={[styles.modal, { maxHeight: '90%' }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Settings
              </Text>

              {/* Dark Mode toggle */}
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: settings.darkMode ? '#4ade80' : '#ddd' },
                ]}
                onPress={() =>
                  setSettings((s) => ({ ...s, darkMode: !s.darkMode }))
                }>
                <Text
                  style={[
                    styles.buttonText,
                    { color: settings.darkMode ? '#000' : '#444' },
                  ]}>
                  Dark Mode: {settings.darkMode ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>

              {/* Show Card Suits toggle */}
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: settings.showCardSuits
                      ? '#4ade80'
                      : '#ddd',
                  },
                ]}
                onPress={() =>
                  setSettings((s) => ({
                    ...s,
                    showCardSuits: !s.showCardSuits,
                  }))
                }>
                <Text
                  style={[
                    styles.buttonText,
                    { color: settings.showCardSuits ? '#000' : '#444' },
                  ]}>
                  Show Card Suits: {settings.showCardSuits ? 'Yes' : 'No'}
                </Text>
              </TouchableOpacity>

              {/* Card Size selection */}
              <Text
                style={[styles.modalSubtitle, { color: colors.textPrimary }]}>
                Card Size
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginBottom: 10,
                }}>
                {['small', 'medium', 'large'].map((size) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() =>
                      setSettings((s) => ({ ...s, cardSize: size }))
                    }
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor:
                        settings.cardSize === size
                          ? '#38bdf8'
                          : isDark
                            ? '#444'
                            : '#eee',
                      minWidth: 70,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        color:
                          settings.cardSize === size
                            ? '#fff'
                            : isDark
                              ? '#fff'
                              : '#000',
                        fontWeight: '600',
                      }}>
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                style={styles.closeBtn}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </LinearGradient>
  );
}
