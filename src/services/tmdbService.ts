const TMDB_API_KEY = '3e7b874ac940f20eaf2ed8b345198aa8';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const tmdbService = {
  async searchMovies(query: string) {
    if (!query) return [];
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
      );
      if (!response.ok) throw new Error('Erro ao buscar filmes');
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('TMDB Search Error:', error);
      return [];
    }
  },

  async getMovieDetails(movieId: number) {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=pt-BR`
      );
      if (!response.ok) throw new Error('Erro ao buscar detalhes do filme');
      return await response.json();
    } catch (error) {
      console.error('TMDB Details Error:', error);
      return null;
    }
  },

  async getTrendingMovies() {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=pt-BR`
      );
      if (!response.ok) throw new Error('Erro ao buscar filmes em destaque');
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('TMDB Trending Error:', error);
      return [];
    }
  },

  getImageUrl(path: string, size: 'w500' | 'original' = 'w500') {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
};
